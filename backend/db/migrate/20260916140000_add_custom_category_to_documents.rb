class AddCustomCategoryToDocuments < ActiveRecord::Migration[8.1]
  def change
    # The free-text name typed when the category is "Other". Kept in its own
    # column rather than stuffed into document_type so that "Other" stays a
    # real, filterable category — storing the custom text in document_type
    # would make every bespoke name its own pseudo-category and there would be
    # no way to ask for "everything filed under Other".
    add_column :documents, :custom_category, :string

    # Documents are listed and filtered per employee, per category.
    add_index :documents, [ :company_id, :document_type ]
  end
end
