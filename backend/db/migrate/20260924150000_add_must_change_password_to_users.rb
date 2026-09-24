class AddMustChangePasswordToUsers < ActiveRecord::Migration[8.1]
  def change
    # Set by Admin when inviting; cleared the moment the person changes their
    # password. While true the account can sign in and do nothing else.
    add_column :users, :must_change_password, :boolean, default: false, null: false
  end
end
