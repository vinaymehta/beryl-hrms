class AddEmployeeCodeInitialToCompanies < ActiveRecord::Migration[8.1]
  def change
    # The first employee code this company issues, e.g. "BOO1". Everything
    # after it is derived by incrementing the trailing number, so the company
    # sets the pattern once instead of typing a code per hire.
    #
    # Nullable and empty by default: a company that has always typed its own
    # codes must keep working exactly as it does, and an empty value means
    # "don't prefill anything" rather than "start at zero".
    add_column :companies, :employee_code_initial, :string
  end
end
