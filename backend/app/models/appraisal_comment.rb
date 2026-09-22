# A reviewer's written comment, carrying its own audience.
#
#   employee_visible — released to the employee once the appraisal is released.
#   management_only  — never leaves the management side, at any stage.
#
# The visibility is enforced by AppraisalCommentPolicy::Scope, so a
# management_only row is filtered out of the query before serialization rather
# than hidden in the UI.
class AppraisalComment < ApplicationRecord
  acts_as_tenant(:company)

  enum :visibility, { employee_visible: 0, management_only: 1 }, default: :management_only, validate: true

  belongs_to :company
  belongs_to :appraisal, inverse_of: :comments
  belongs_to :appraisal_revision, optional: true, inverse_of: :comments
  belongs_to :author_user, class_name: "User"

  before_validation :set_company_from_appraisal

  validates :body, presence: true, length: { maximum: 5_000 }

  scope :newest_first, -> { order(created_at: :desc) }

  private
    def set_company_from_appraisal
      self.company_id ||= appraisal&.company_id
    end
end
