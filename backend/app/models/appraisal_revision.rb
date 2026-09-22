# One immutable snapshot of an appraisal: V1 (employee self-appraisal), V2
# (primary manager), V3 (secondary manager), Final (final manager/calibration),
# and any further revision a return-for-correction produces.
#
# IMMUTABLE is enforced, not merely intended: #readonly? refuses every update
# after create, so no controller, service or console slip can rewrite history.
# A correction adds a revision; it never edits one.
#
# `version_number` is derived from the existing history (MAX + 1), so nothing
# caps the sequence at three.
class AppraisalRevision < ApplicationRecord
  acts_as_tenant(:company)

  enum :stage, {
    self_appraisal: 0,
    primary_review: 1,
    secondary_review: 2,
    final_review: 3
  }, prefix: true, validate: true

  belongs_to :company
  belongs_to :appraisal, inverse_of: :revisions
  belongs_to :author_employee, class_name: "Employee", optional: true
  belongs_to :author_user, class_name: "User", optional: true
  has_many :answers,
           class_name: "AppraisalAnswer",
           foreign_key: :appraisal_revision_id,
           dependent: :destroy,
           inverse_of: :appraisal_revision
  has_many :comments, class_name: "AppraisalComment", dependent: :nullify, inverse_of: :appraisal_revision

  before_validation :set_company_from_appraisal
  before_validation :assign_version_number, on: :create
  before_validation :stamp_submitted_at, on: :create

  validates :version_number, presence: true, uniqueness: { scope: :appraisal_id }
  validates :submitted_at, presence: true

  # The label people actually use. Not stored, so it can never disagree with
  # version_number.
  def label = "V#{version_number}"

  # ActiveRecord consults this on every save; returning true after the record
  # exists makes the row write-once at the ORM level.
  def readonly?
    persisted? && !@allow_initial_write
  end

  # Used only by the creating service, which needs one post-insert write to
  # attach the calculated score. Deliberately awkward to reach for.
  def with_initial_write
    @allow_initial_write = true
    yield self
  ensure
    @allow_initial_write = false
  end

  private
    def set_company_from_appraisal
      self.company_id ||= appraisal&.company_id
    end

    def assign_version_number
      return if version_number.present? || appraisal.nil?

      self.version_number = (appraisal.revisions.maximum(:version_number) || 0) + 1
    end

    def stamp_submitted_at
      self.submitted_at ||= Time.current
    end
end
