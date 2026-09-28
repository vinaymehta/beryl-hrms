class AppraisalTemplateCategory < ApplicationRecord
  acts_as_tenant(:company)

  # Legacy: the scope's three "lenses" (Past / Current / Future), once tagged
  # on each category and required before activation. The company workbook has
  # no such tag — its Performance Perspective block is a separate section the
  # MANAGER fills in (see TemplateImport#wizard_sections) — so the tag is no
  # longer asked for or required. Kept, optional, for templates that have one.
  enum :lens, { past: 0, current_capability: 1, future_readiness: 2 },
       prefix: true, validate: { allow_nil: true }

  LENS_TARGET_WEIGHTS = { "past" => 60, "current_capability" => 25, "future_readiness" => 15 }.freeze

  belongs_to :company
  belongs_to :appraisal_template, inverse_of: :categories
  has_many :questions,
           -> { order(:position) },
           class_name: "AppraisalTemplateQuestion",
           dependent: :destroy,
           inverse_of: :appraisal_template_category
  accepts_nested_attributes_for :questions, allow_destroy: true

  before_validation :set_company_from_template

  validates :name, presence: true
  validates :weight, numericality: { greater_than: 0, less_than_or_equal_to: 100 }

  private
    def set_company_from_template
      self.company_id ||= appraisal_template&.company_id
    end
end
