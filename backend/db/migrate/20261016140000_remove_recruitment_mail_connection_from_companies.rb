# Undoes 20261016100000. Recruitment email no longer goes out through a Zoho
# mailbox — it is ordinary app mail (Resend, from MAIL_FROM) like everything
# else the app sends — so there is no "recruitment sender" mailbox to pick.
# Zoho is only read from, and sent from by hand on the Mail page.
class RemoveRecruitmentMailConnectionFromCompanies < ActiveRecord::Migration[8.1]
  def change
    remove_reference :companies, :recruitment_mail_connection,
                     foreign_key: { to_table: :zoho_connections, on_delete: :nullify }
  end
end
