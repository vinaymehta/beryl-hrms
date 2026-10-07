class AddCurrentPasswordCopyToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :current_password_copy, :text
  end
end
