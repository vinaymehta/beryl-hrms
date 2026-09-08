class CreateDocuments < ActiveRecord::Migration[8.1]
  def change
    create_table :documents do |t|
      t.references :company, null: false, foreign_key: true
      t.references :employee, null: true, foreign_key: true
      t.string :document_type
      t.string :title
      t.references :uploaded_by, null: false, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :documents, [ :company_id, :employee_id ]
  end
end
