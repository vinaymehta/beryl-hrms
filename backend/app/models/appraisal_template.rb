# A question set. Versioned in its own right, and FROZEN the moment a cycle
# starts using it — editing an active template would silently rewrite the
# questions historical appraisals were answered against.
#
# Template versioning is deliberately separate from appraisal revision
# versioning (V1/V2/V3). One says "which questions"; the other says "whose
# answers". Neither drives the other.
class AppraisalTemplate < ApplicationRecord
  acts_as_tenant(:company)

  enum :status, { draft: 0, active: 1, archived: 2 }, default: :draft, validate: true

  belongs_to :company
  belongs_to :created_by, class_name: "User", optional: true
  has_many :categories,
           -> { order(:position) },
           class_name: "AppraisalTemplateCategory",
           dependent: :destroy,
           inverse_of: :appraisal_template
  has_many :questions, through: :categories
  has_many :appraisal_cycles, dependent: :restrict_with_error

  accepts_nested_attributes_for :categories, allow_destroy: true

  validates :name, presence: true
  validate :category_weights_total_one_hundred, if: -> { active? && categories.any? }
  validate :every_category_has_a_lens, if: -> { active? && categories.any? }

  validate :refuse_edit_once_in_use, on: :update

  before_create :assign_lineage_and_version
  after_create :anchor_lineage_to_self

  scope :usable, -> { where(status: :active) }

  # Every version of this template, oldest first.
  def lineage
    self.class.where(lineage_id: lineage_id || id).order(:version)
  end

  # Whether any cycle has ever started against this template. Once true the
  # question set is history and must not move.
  def in_use?
    appraisal_cycles.where.not(started_at: nil).exists?
  end

  # The supported way to change an active template: a NEW version, leaving
  # every appraisal already answered against this one exactly as it was.
  def build_next_version(attrs = {})
    copy = self.class.new(
      attributes.slice("company_id", "name", "description", "structure")
        .merge("lineage_id" => lineage_id || id, "status" => "draft")
        .merge(attrs.stringify_keys)
    )

    categories.each do |category|
      copied_category = copy.categories.build(
        category.attributes.slice("company_id", "name", "description", "lens", "weight", "position")
      )
      category.questions.each do |question|
        copied_category.questions.build(
          question.attributes.slice(
            "company_id", "prompt", "description", "position",
            "self_rating", "manager_rating", "requires_comment", "required"
          )
        )
      end
    end

    copy
  end

  private
    # A template can sit in draft with perspectives still to be decided — an
    # imported workbook arrives that way by design. Running a cycle against one
    # cannot, because the perspective is what the lens rollup and calibration
    # are computed over.
    def every_category_has_a_lens
      missing = categories.reject(&:marked_for_destruction?).select { |category| category.lens.blank? }
      return if missing.empty?

      errors.add(
        :categories,
        "need a performance perspective before this template can be activated " \
        "(#{missing.map(&:name).to_sentence})"
      )
    end

    def assign_lineage_and_version
      return if lineage_id.blank?

      self.version = (self.class.where(lineage_id: lineage_id).maximum(:version) || 0) + 1
    end

    # A root template has no lineage yet at insert time, so it points at itself
    # immediately afterwards. Without this the root sits outside its own
    # lineage and `maximum(:version)` misses it, making every "new version"
    # come back as v1.
    def anchor_lineage_to_self
      update_column(:lineage_id, id) if lineage_id.blank?
    end

    # A validation rather than a `throw :abort` in a callback: aborting raises
    # RecordNotSaved, which carries no message and so reached the client as a
    # bare 422 with an empty errors array. As a validation it surfaces through
    # the same RecordInvalid path every other bad field uses.
    def refuse_edit_once_in_use
      return unless in_use?
      # Archiving is always allowed — it only stops NEW cycles choosing it and
      # changes nothing about the questions themselves.
      return if (changed - %w[status updated_at lineage_id]).empty?

      errors.add(:base, "This template is in use by a started cycle — create a new version instead")
    end

    # The scope's rule, enforced rather than described. Checked on activation
    # so a half-built draft isn't blocked while it's still being written.
    def category_weights_total_one_hundred
      total = categories.reject(&:marked_for_destruction?).sum { |c| c.weight.to_d }
      return if total == 100

      errors.add(:base, "Category weights must total 100% (currently #{total.to_f.round(2)}%)")
    end
end
