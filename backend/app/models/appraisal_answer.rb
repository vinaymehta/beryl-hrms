# One author's rating and comment for one question, inside one revision.
#
# Deliberately NOT "self_rating + manager_rating" columns on a shared row: each
# revision belongs to exactly one author, so a revision's answers ARE that
# person's independent view. That is what keeps an employee's self-rating and
# their manager's rating from ever being merged into a single value.
class AppraisalAnswer < ApplicationRecord
  acts_as_tenant(:company)

  RATING_RANGE = (1..5).freeze
  # The scope's rule: a rating at either extreme, or adjacent to one, has to be
  # justified. 3 is the only rating that can stand without evidence.
  RATINGS_REQUIRING_COMMENT = [ 1, 2, 4, 5 ].freeze

  belongs_to :company
  belongs_to :appraisal_revision, inverse_of: :answers
  belongs_to :appraisal_template_question

  before_validation :set_company_from_revision

  validates :rating,
            inclusion: { in: RATING_RANGE, message: "must be between 1 and 5" },
            allow_nil: true
  validates :appraisal_template_question_id, uniqueness: { scope: :appraisal_revision_id }
  validate :comment_present_for_extreme_ratings
  validate :comment_present_when_question_requires_it

  def readonly? = persisted?

  private
    def set_company_from_revision
      self.company_id ||= appraisal_revision&.company_id
    end

    def comment_present_for_extreme_ratings
      return if rating.blank? || comment.present?
      return unless RATINGS_REQUIRING_COMMENT.include?(rating)

      errors.add(:comment, "is required for a rating of #{rating}")
    end

    def comment_present_when_question_requires_it
      return if comment.present? || appraisal_template_question.nil?
      return unless appraisal_template_question.requires_comment?

      errors.add(:comment, "is required for this question")
    end
end
