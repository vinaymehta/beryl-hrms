# One row of the employee skill matrix (§20).
#
# Deliberately not CandidateSkill: that belongs to a recruitment Candidate and
# carries AI provenance/confidence fields that mean nothing for a validated
# employee capability.
class EmployeeSkill < ApplicationRecord
  include EmployeeOwned

  enum :proficiency, { beginner: 0, working: 1, proficient: 2, advanced: 3, expert: 4 },
       prefix: true, default: :working, validate: true

  belongs_to :validated_by, class_name: "User", optional: true

  validates :name, presence: true, uniqueness: { scope: :employee_id, case_sensitive: false }

  # §20 asks for evidence/validation, so validating stamps who and when rather
  # than just flipping a boolean.
  def validate_by!(user)
    update!(validated: true, validated_by: user, validated_on: Date.current)
  end
end
