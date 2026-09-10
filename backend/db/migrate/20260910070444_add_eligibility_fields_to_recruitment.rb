class AddEligibilityFieldsToRecruitment < ActiveRecord::Migration[8.1]
  def change
    # Profile facts, synced from the candidate's current resume the same way
    # highest_qualification/experience_years already are. Left nullable with
    # no default so "not extracted yet" (nil) is distinguishable from a
    # confirmed false/0 — the eligibility evaluator treats nil as unknown,
    # never as a pass or a fail.
    add_column :candidates, :academic_percentage, :decimal, precision: 5, scale: 2
    add_column :candidates, :academic_cgpa, :decimal, precision: 4, scale: 2
    add_column :candidates, :graduation_year, :integer
    add_column :candidates, :active_backlogs, :boolean

    # Per-submission processing results, alongside extracted_data/provenance_data.
    add_column :candidate_resumes, :ats_score, :integer
    add_column :candidate_resumes, :criteria_match_percentage, :integer
    add_column :candidate_resumes, :eligibility_breakdown, :jsonb, default: {}
  end
end
