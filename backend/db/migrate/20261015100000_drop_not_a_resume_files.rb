# "Not a Resume" files are no longer kept: the file and its row are deleted
# and only a skip-note stays behind — the mail attachment id (so the scan
# never imports that attachment again) and the file's SHA-256 (so the same
# bytes arriving from another mailbox are dropped before any AI call). No
# content, name or sender is kept.
#
# The existing not_a_resume rows (processing_status 4), and any duplicates
# pointing at them, become skip-notes and are deleted with their files.
# Deleted files can't be brought back, so `down` only drops the table.
class DropNotAResumeFiles < ActiveRecord::Migration[8.1]
  NOT_A_RESUME = 4

  def up
    create_table :skipped_mail_attachments do |t|
      t.references :company, null: false, foreign_key: true
      t.string :source_attachment_id
      t.string :file_hash
      t.datetime :created_at, null: false
    end
    add_index :skipped_mail_attachments, [ :company_id, :source_attachment_id ], unique: true,
              where: "source_attachment_id IS NOT NULL"
    add_index :skipped_mail_attachments, [ :company_id, :file_hash ]

    ids = select_values(<<~SQL.squish).map(&:to_i)
      SELECT id FROM candidate_resumes WHERE processing_status = #{NOT_A_RESUME}
      UNION
      SELECT id FROM candidate_resumes WHERE duplicate_of_id IN
        (SELECT id FROM candidate_resumes WHERE processing_status = #{NOT_A_RESUME})
    SQL
    return if ids.empty?

    list = ids.join(",")
    execute <<~SQL.squish
      INSERT INTO skipped_mail_attachments (company_id, source_attachment_id, file_hash, created_at)
      SELECT company_id, source_attachment_id, file_hash, NOW() FROM candidate_resumes WHERE id IN (#{list})
      ON CONFLICT DO NOTHING
    SQL
    # Purging touches the tenant-scoped CandidateResume record.
    ActsAsTenant.without_tenant do
      ActiveStorage::Attachment.where(record_type: "CandidateResume", record_id: ids).find_each(&:purge)
    end
    execute "UPDATE ai_processing_logs SET candidate_resume_id = NULL WHERE candidate_resume_id IN (#{list})"
    execute "UPDATE candidate_resumes SET duplicate_of_id = NULL WHERE duplicate_of_id IN (#{list})"
    execute "DELETE FROM candidate_resumes WHERE id IN (#{list})"
  end

  def down
    drop_table :skipped_mail_attachments
  end
end
