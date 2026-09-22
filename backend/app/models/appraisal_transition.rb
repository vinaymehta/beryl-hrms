# Every status change, with who made it. Append-only: the workflow's audit
# trail is only worth having if nothing can quietly rewrite it.
class AppraisalTransition < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  belongs_to :appraisal, inverse_of: :transitions
  belongs_to :actor_user, class_name: "User", optional: true

  before_validation :set_company_from_appraisal

  validates :to_status, presence: true

  def readonly? = persisted?

  # Integers in the column, names out — the enum lives on Appraisal, so read it
  # from there rather than duplicating the mapping.
  def from_status_name = from_status && Appraisal.statuses.key(from_status)
  def to_status_name = Appraisal.statuses.key(to_status)

  private
    def set_company_from_appraisal
      self.company_id ||= appraisal&.company_id
    end
end
