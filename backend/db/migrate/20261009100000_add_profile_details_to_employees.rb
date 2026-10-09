# The self-service profile: several phone numbers instead of one, several
# emergency contacts instead of one, a celebration date, bank details and the
# two identity numbers.
#
# `phone`, `emergency_contact_name` and `emergency_contact_phone` are replaced
# rather than kept alongside: two places holding "the employee's phone" is two
# places that disagree. Their values are copied across first, exactly as they
# were stored, so nothing on file is lost:
#   • a stored phone becomes the only entry in `phones`;
#   • a stored emergency name and/or phone becomes the first (and only)
#     emergency contact, with no relation — it was never recorded.
#
# The bank account number, Aadhaar and PAN columns hold Active Record
# encryption ciphertext (Employee `encrypts`), which is why they are plain
# unlimited strings rather than anything sized to the number itself.
class AddProfileDetailsToEmployees < ActiveRecord::Migration[8.1]
  def up
    change_table :employees, bulk: true do |t|
      t.string :phones, array: true, default: [], null: false
      t.jsonb :emergency_contacts, default: [], null: false
      t.date :celebration_date
      t.string :bank_account_number
      t.string :bank_account_holder_name
      t.string :bank_ifsc_code
      t.string :aadhaar_number
      t.string :pan_number
    end

    execute <<~SQL.squish
      UPDATE employees SET phones = ARRAY[phone]
      WHERE NULLIF(BTRIM(phone), '') IS NOT NULL
    SQL

    execute <<~SQL.squish
      UPDATE employees
      SET emergency_contacts = jsonb_build_array(jsonb_build_object(
        'name', NULLIF(BTRIM(emergency_contact_name), ''),
        'relation', NULL,
        'phone', NULLIF(BTRIM(emergency_contact_phone), '')
      ))
      WHERE NULLIF(BTRIM(emergency_contact_name), '') IS NOT NULL
         OR NULLIF(BTRIM(emergency_contact_phone), '') IS NOT NULL
    SQL

    change_table :employees, bulk: true do |t|
      t.remove :phone, :emergency_contact_name, :emergency_contact_phone
    end
  end

  # Puts the FIRST phone and the FIRST emergency contact back. Anything past
  # the first had nowhere to live before this migration, so it can't survive
  # going back past it.
  def down
    change_table :employees, bulk: true do |t|
      t.string :phone
      t.string :emergency_contact_name
      t.string :emergency_contact_phone
    end

    execute "UPDATE employees SET phone = phones[1]"
    execute <<~SQL.squish
      UPDATE employees
      SET emergency_contact_name = emergency_contacts -> 0 ->> 'name',
          emergency_contact_phone = emergency_contacts -> 0 ->> 'phone'
    SQL

    change_table :employees, bulk: true do |t|
      t.remove :phones, :emergency_contacts, :celebration_date,
               :bank_account_number, :bank_account_holder_name, :bank_ifsc_code,
               :aadhaar_number, :pan_number
    end
  end
end
