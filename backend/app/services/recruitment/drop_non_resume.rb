module Recruitment
  # A file that turned out not to be a resume is not kept: it and its row
  # are deleted (destroying the row purges its file), along with any
  # duplicate copies of the same bytes, leaving only a skip-note
  # (SkippedMailAttachment) so the scan doesn't import — and send to the AI —
  # the same attachment or the same file again.
  #
  # Except a file sent with a careers-website application: that person did
  # apply, so their application is kept and its file is marked failed for HR
  # to look at instead.
  class DropNonResume
    NOT_A_RESUME = "The file sent with this application doesn't look like a resume.".freeze

    def self.call(...) = new(...).call

    def initialize(resume)
      @resume = resume
    end

    def call
      applications, rows = [ *@resume.duplicates.to_a, @resume ].partition(&:job_application)
      CandidateResume.transaction do
        rows.each { |row| leave_note(row) }
        rows.each(&:destroy!)
        applications.each { |row| row.update!(processing_status: :failed, error_message: NOT_A_RESUME) }
      end
    end

    private
      def leave_note(row)
        if row.source_attachment_id.present?
          SkippedMailAttachment.create_or_find_by!(
            company_id: row.company_id, source_attachment_id: row.source_attachment_id
          ) { |note| note.file_hash = row.file_hash }
        elsif row.file_hash.present?
          SkippedMailAttachment.find_or_create_by!(company_id: row.company_id, file_hash: row.file_hash)
        end
      end
  end
end
