# One author's rating and comment for one question, inside one revision.
#
# Deliberately NOT "self_rating + manager_rating" columns on a shared row: each
# revision belongs to exactly one author, so a revision's answers ARE that
# person's independent view. That is what keeps an employee's self-rating and
# their manager's rating from ever being merged into a single value.
class AppraisalAnswer < ApplicationRecord
  acts_as_tenant(:company)

  # Half-star ratings: 1 to 5 in steps of 0.5 (1, 1.5, 2 … 4.5, 5). The
  # template's rating GUIDE stays whole levels 1–5; only an answer can sit
  # between two of them.
  RATING_RANGE = (1.to_d..5.to_d).freeze
  RATING_STEP = BigDecimal("0.5")
  RATING_VALUES = RATING_RANGE.step(RATING_STEP).to_a.freeze
  RATING_ERROR = "must be between 1 and 5, in steps of 0.5".freeze
  # Every rating has to be justified with evidence — including a middling 3,
  # which used to be the one rating allowed to stand on its own.
  RATINGS_REQUIRING_COMMENT = RATING_VALUES

  belongs_to :company
  belongs_to :appraisal_revision, inverse_of: :answers
  belongs_to :appraisal_template_question

  before_validation :set_company_from_revision

  validate :rating_on_the_scale
  validates :appraisal_template_question_id, uniqueness: { scope: :appraisal_revision_id }
  validate :comment_present_for_extreme_ratings
  validate :comment_present_when_question_requires_it

  def readonly? = persisted?

  # A rating as typed, posted or read out of a spreadsheet — Integer, Float,
  # BigDecimal or a String like "3.5" — as a BigDecimal, or nil when it is
  # blank or not a number at all. Shared with the workbook import and the
  # perspective ratings so every way in reads a rating the same way.
  def self.parse_rating(raw)
    return raw.to_d if raw.is_a?(Numeric)

    text = raw.to_s.strip
    text.match?(/\A-?\d+(\.\d+)?\z/) ? text.to_d : nil
  end

  def self.valid_rating?(value)
    value.present? && RATING_VALUES.include?(parse_rating(value))
  end

  # "3.5" / "4" — never BigDecimal#to_s's "0.35e1", which is what a decimal
  # interpolated into a message would otherwise read as.
  def self.format_rating(value)
    rating = parse_rating(value)
    return nil if rating.nil?

    rating.frac.zero? ? rating.to_i.to_s : rating.to_s("F")
  end

  private
    def set_company_from_revision
      self.company_id ||= appraisal_revision&.company_id
    end

    # Checked against the value as it ARRIVED, not the cast one: the column's
    # scale of 1 would otherwise round 4.96 to 5.0 and 3.25 to 3.3 before
    # this ever saw them, quietly accepting a rating nobody chose.
    def rating_on_the_scale
      raw = rating_before_type_cast
      return if raw.blank?
      return if self.class.valid_rating?(raw)

      errors.add(:rating, RATING_ERROR)
    end

    def comment_present_for_extreme_ratings
      return if rating.blank? || comment.present?
      return unless RATINGS_REQUIRING_COMMENT.include?(rating)

      errors.add(:comment, "is required for a rating of #{self.class.format_rating(rating)}")
    end

    def comment_present_when_question_requires_it
      return if comment.present? || appraisal_template_question.nil?
      return unless appraisal_template_question.requires_comment?

      errors.add(:comment, "is required for this question")
    end
end
