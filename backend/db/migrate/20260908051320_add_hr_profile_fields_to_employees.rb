class AddHrProfileFieldsToEmployees < ActiveRecord::Migration[8.1]
  def change
    add_column :employees, :date_of_birth, :date
    add_column :employees, :gender, :string
    add_column :employees, :phone, :string
    add_column :employees, :personal_email, :string
    add_column :employees, :address_line1, :string
    add_column :employees, :address_line2, :string
    add_column :employees, :city, :string
    add_column :employees, :state, :string
    add_column :employees, :postal_code, :string
    add_column :employees, :country, :string
    add_column :employees, :emergency_contact_name, :string
    add_column :employees, :emergency_contact_phone, :string
  end
end
