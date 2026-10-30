# The openings shown on the public careers website, managed from Job
# Administration. Not the `jobs` table: that one describes roles for resume
# matching inside Recruitment, and the two are deliberately unrelated.
#
# Single-company by design (Beryl's own website), so there is no company_id
# and the model is not tenant-scoped. Column types and defaults match the
# table the website was built against: text throughout, jsonb string lists,
# and timestamptz timestamps with database defaults.
class CreateJobOpenings < ActiveRecord::Migration[8.1]
  def change
    create_table :job_openings, id: :serial do |t|
      t.text :code, null: false
      t.text :slug, null: false
      t.text :title, null: false
      t.text :category, null: false
      t.text :employment_type, null: false, default: "Full-time"
      t.text :location, null: false
      t.date :date_posted, null: false, default: -> { "CURRENT_DATE" }
      t.text :summary, null: false
      t.text :intro, null: false
      t.text :about, null: false
      t.jsonb :responsibilities, null: false, default: []
      t.jsonb :requirements, null: false, default: []
      t.jsonb :nice_to_have, null: false, default: []
      t.text :growth_heading, null: false, default: "What you'll learn"
      t.jsonb :growth_items, null: false, default: []
      t.text :role_question, null: false, default: ""
      t.boolean :is_active, null: false, default: true
      t.integer :sort_order, null: false, default: 0
      t.timestamptz :created_at, null: false, default: -> { "now()" }
      t.timestamptz :updated_at, null: false, default: -> { "now()" }
    end
    add_index :job_openings, :code, unique: true
    add_index :job_openings, :slug, unique: true
  end
end
