# The mailbox every recruitment email is sent from (booking link, interview
# booked, feedback request), chosen in Settings → Zoho Mail. Empty means "the
# oldest connected mailbox", which is how it worked before there was a choice.
# Removing that mailbox clears the choice rather than blocking the removal.
class AddRecruitmentMailConnectionToCompanies < ActiveRecord::Migration[8.1]
  def change
    add_reference :companies, :recruitment_mail_connection,
                  foreign_key: { to_table: :zoho_connections, on_delete: :nullify }
  end
end
