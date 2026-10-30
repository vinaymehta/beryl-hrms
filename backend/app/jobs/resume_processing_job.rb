class ResumeProcessingJob < ApplicationJob
  queue_as :default

  # Only the download step talks to a remote service (Zoho) — these are the
  # transient failures worth retrying. A give-up block (not a bare re-raise)
  # runs after the final attempt so the resume is always left in a terminal
  # `failed` state instead of stuck `processing` forever with a dead job.
  RETRYABLE_ERRORS = [ Ai::RateLimitedError, Faraday::TimeoutError, Faraday::ConnectionFailed, Net::OpenTimeout ].freeze

  retry_on(*RETRYABLE_ERRORS, wait: :polynomially_longer, attempts: 4) do |job, error|
    job.send(:handle_exhausted_retries, error)
  end

  def perform(candidate_resume_id)
    @candidate_resume_id = candidate_resume_id
    resume = CandidateResume.unscoped.find_by(id: candidate_resume_id)
    return unless resume

    ActsAsTenant.with_tenant(resume.company) do
      download_and_extract(resume)
    end
  end

  private

  # Stage 1 of the pipeline: attachment download + fingerprinting + deterministic
  # text extraction. Kept separate from AI extraction (ResumeExtractionJob) so a
  # slow/rate-limited Claude call doesn't retry the whole download-and-extract
  # step, and a bad document format doesn't consume an AI-retry budget.
  def download_and_extract(resume)
    resume.update!(processing_status: :processing, error_message: nil)

    ensure_file_attached!(resume)

    binary = resume.file.download
    file_hash = Digest::SHA256.hexdigest(binary)

    # The same bytes were already judged not to be a resume (reaching the
    # company again from another mailbox or attachment): dropped straight
    # away, with no AI call.
    if SkippedMailAttachment.file?(file_hash)
      resume.update!(file_hash: file_hash)
      Recruitment::DropNonResume.call(resume)
      return
    end

    # Identical file bytes as an existing resume — same submission,
    # resubmitted (re-sent by email, re-uploaded, or the same mail reaching
    # two of the company's connected mailboxes). Keep both rows (never
    # delete/merge automatically) but skip AI reprocessing entirely;
    # source_email_id/source_attachment_id on this row are untouched so the
    # new inbound reference is preserved.
    original = claim_file_hash!(resume, file_hash, binary.bytesize)
    if original
      # The same file sent with a careers application (applying for a second
      # opening, say): no new candidate is extracted from it, so the
      # application goes to whoever the original resume belongs to.
      resume.job_application&.update!(candidate: original.candidate) if original.candidate
      return
    end

    extraction = Recruitment::DocumentTextExtractor.extract(
      binary,
      filename: resume.file_name,
      content_type: resume.content_type
    )

    if extraction[:text].blank?
      resume.update!(
        processing_status: :failed,
        error_message: extraction[:error] || "Could not extract readable text from document."
      )
      return
    end

    resume.update!(raw_text: extraction[:text])
    ResumeExtractionJob.perform_later(resume.id)
  rescue *RETRYABLE_ERRORS => e
    Rails.logger.warn("ResumeProcessingJob transient failure for CandidateResume##{resume.id}, will retry: #{e.message}")
    raise
  rescue => e
    Rails.logger.error("ResumeProcessingJob failed for CandidateResume##{resume.id}: #{e.message}\n#{e.backtrace.take(5).join("\n")}")
    resume.update!(
      processing_status: :failed,
      error_message: e.message,
      retries_count: resume.retries_count + 1
    )
  end

  # Records this resume's file hash and finds the resume that already holds
  # the same bytes, marking this one its duplicate — or nil when this is the
  # first copy.
  #
  # Mailboxes are scanned in parallel and every imported resume is processed
  # by its own job, so two copies of one file regularly reach this point at
  # the same moment. Without serialising them, each could set its hash and
  # look for the other before either had decided: both found the other and
  # both ended up `duplicate` (the file vanished from every list), or neither
  # saw the other's hash yet and both were processed as originals. A
  # transaction-scoped Postgres advisory lock on (company, hash) makes
  # "record my hash, then look for an earlier holder" one step per file, so
  # exactly one copy — whichever gets here first — stays the original.
  def claim_file_hash!(resume, file_hash, file_size)
    lock_key = Digest::SHA256.digest("candidate_resume_file_hash/#{resume.company_id}/#{file_hash}").unpack1("q>")

    CandidateResume.transaction do
      CandidateResume.connection.execute(
        CandidateResume.sanitize_sql_array([ "SELECT pg_advisory_xact_lock(?)", lock_key ])
      )
      resume.update!(file_hash: file_hash, file_size: file_size)

      # `duplicate_of_id: nil` alone is NOT a reliable "this row is an
      # original" test. Deleting a resume nullifies its duplicates' pointers
      # (has_many :duplicates, dependent: :nullify) but leaves their status
      # as `duplicate` — so a deleted original leaves behind orphans that
      # look like originals to this query. Re-sending that same file then
      # matched an orphan, marked the new copy duplicate too, and the file
      # stayed invisible no matter how many times it was re-sent. Excluding
      # rows that are themselves duplicates makes the test mean what it says.
      original = resume.company.candidate_resumes
                       .where(file_hash: file_hash, duplicate_of_id: nil)
                       .where.not(processing_status: :duplicate)
                       .where.not(id: resume.id)
                       .order(:created_at)
                       .first

      resume.update!(processing_status: :duplicate, duplicate_of_id: original.id, is_current: false) if original
      original
    end
  end

  def handle_exhausted_retries(error)
    resume = CandidateResume.unscoped.find_by(id: @candidate_resume_id)
    return unless resume

    ActsAsTenant.with_tenant(resume.company) do
      Rails.logger.error("ResumeProcessingJob exhausted retries for CandidateResume##{resume.id}: #{error.message}")
      resume.update!(
        processing_status: :failed,
        error_message: "Mailbox temporarily unavailable after retries: #{error.message}",
        retries_count: resume.retries_count + 1
      )
    end
  end

  def ensure_file_attached!(resume)
    return if resume.file.attached?

    unless resume.source_email_id.present? && resume.source_attachment_id.present?
      raise "No file attached and no Zoho source identifiers provided."
    end

    file_data = download_from_any_mailbox(resume)
    # The row's own name over the download's: Zoho sends a bare "attachment"
    # placeholder when it gives no Content-Disposition name.
    file_name = resume.file_name.presence || file_data[:filename]

    resume.file.attach(
      io: StringIO.new(file_data[:body]),
      filename: file_name,
      content_type: Recruitment::ResumeContentType.resolve(
        filename: file_name, reported: file_data[:content_type], body: file_data[:body]
      )
    )
  end

  # A resume doesn't record which of the company's mailboxes it came from,
  # and with several connected the message id only exists in one of them —
  # so each active mailbox is tried in turn until one has it. Zoho answers a
  # message from another account with an API error, which just moves on to
  # the next; network/rate-limit failures still propagate to the retry
  # handling above.
  def download_from_any_mailbox(resume)
    connections = resume.company.zoho_connections.active.order(:id).to_a
    raise "No active Zoho Mail connection found for company #{resume.company_id}" if connections.empty?

    last_error = nil
    connections.each do |connection|
      mailbox = Zoho::Mailbox.new(connection)
      return Zoho::Client.new.download_attachment(
        access_token: mailbox.access_token,
        account_id: mailbox.account_id,
        message_id: resume.source_email_id,
        attachment_id: resume.source_attachment_id
      )
    rescue Zoho::RateLimitedError
      raise
    rescue Zoho::ApiError => e
      last_error = e
    end

    raise last_error
  end
end
