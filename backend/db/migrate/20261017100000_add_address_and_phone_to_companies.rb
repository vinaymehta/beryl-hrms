# The company's postal address and phone number, printed under its legal name
# at the head of the salary slip. Both optional: a slip without them simply
# leaves those lines out. The address is free text, one line per line printed.
class AddAddressAndPhoneToCompanies < ActiveRecord::Migration[8.1]
  def change
    add_column :companies, :address, :text
    add_column :companies, :phone, :string
  end
end
