class AddInvitationColumnsToUsers < ActiveRecord::Migration[8.1]
  def change
    # When the CURRENT invitation was sent. Also the token's nonce: re-inviting
    # restamps this, which invalidates any link already in the mailbox, so only
    # the newest invitation email ever works.
    add_column :users, :invited_at, :datetime

    # When the person finished setting their own password. Non-null means the
    # invitation is spent; combined with the password salt in the token payload
    # it is what makes an invitation link single-use.
    add_column :users, :invitation_accepted_at, :datetime

    # Finding everyone still waiting is the one query the Employees list runs
    # against these columns.
    add_index :users, [ :company_id, :invited_at ],
              where: "invitation_accepted_at IS NULL",
              name: "index_users_pending_invitation"
  end
end
