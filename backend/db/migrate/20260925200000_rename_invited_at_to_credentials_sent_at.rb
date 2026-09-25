class RenameInvitedAtToCredentialsSentAt < ActiveRecord::Migration[8.1]
  # The invitation-link flow is gone: an employee is now emailed a password and
  # signs in with it, so there is nothing to "invite" them to accept. The
  # column still records the same moment — when their sign-in details went out
  # — under a name that says so.
  #
  # The partial index went with it. It existed to find accounts still waiting
  # on an invitation, and no account waits any more: it has a password from the
  # moment the mail is sent.
  def change
    remove_index :users, column: %i[company_id invited_at], name: "index_users_pending_invitation"
    rename_column :users, :invited_at, :credentials_sent_at
    add_index :users, %i[company_id credentials_sent_at]
  end
end
