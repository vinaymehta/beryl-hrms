# What is left of a file the AI judged not to be a resume: no file, no
# content, no sender — only the mail attachment id, so the scan never
# imports it again, and the file's SHA-256, so the same bytes reaching the
# company another way are dropped before any AI call.
# See Recruitment::DropNonResume.
class SkippedMailAttachment < ApplicationRecord
  acts_as_tenant(:company)
  self.record_timestamps = false

  belongs_to :company

  before_create { self.created_at ||= Time.current }

  def self.attachment?(attachment_id)
    attachment_id.present? && exists?(source_attachment_id: attachment_id.to_s)
  end

  def self.file?(file_hash)
    file_hash.present? && exists?(file_hash: file_hash)
  end
end
