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
    resume.update!(file_hash: file_hash, file_size: binary.bytesize)

    original = resume.company.candidate_resumes
                     .where(file_hash: file_hash, duplicate_of_id: nil)
                     .where.not(id: resume.id)
                     .order(:created_at)
                     .first

    if original
      # Identical file bytes as an existing resume — same submission, resubmitted
      # (e.g. re-sent by email, or re-uploaded). Keep both rows (never delete/merge
      # automatically) but skip AI reprocessing entirely; source_email_id/
      # source_attachment_id on this row are untouched so the new inbound
      # reference is preserved.
      resume.update!(processing_status: :duplicate, duplicate_of_id: original.id, is_current: false)
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

    if resume.source_email_id.present? && resume.source_attachment_id.present?
      connection = resume.company.zoho_connections.where(status: :active).first
      raise "No active Zoho Mail connection found for company #{resume.company_id}" unless connection

      client = Zoho::Client.new
      account_id = Rails.cache.fetch("zoho_account_id/#{connection.id}", expires_in: 1.hour) do
        client.fetch_account_id(access_token: connection.access_token)
      end

      file_data = client.download_attachment(
        access_token: connection.access_token,
        account_id: account_id,
        message_id: resume.source_email_id,
        attachment_id: resume.source_attachment_id
      )

      resume.file.attach(
        io: StringIO.new(file_data[:body]),
        filename: file_data[:filename] || resume.file_name,
        content_type: file_data[:content_type] || "application/pdf"
      )
    else
      raise "No file attached and no Zoho source identifiers provided."
    end
  end
end
