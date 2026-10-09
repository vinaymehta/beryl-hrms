# Identity documents beyond Aadhaar and PAN — passport, driving licence, voter ID, UAN and the like — as a list
# of { label, number }. Text, not jsonb: the list is encrypted at rest like the other identity numbers, so the
# database only ever holds ciphertext.
class AddOtherIdentityNumbersToEmployees < ActiveRecord::Migration[8.1]
  def change
    add_column :employees, :other_identity_numbers, :text
  end
end
