# An opening on the public careers website, managed from Job Administration
# and read by the website through Api::V1::Public::JobOpeningsController.
#
# Unrelated to Job (the roles Recruitment matches resumes against), and not
# tenant-scoped: the website is Beryl's own, so the table has no company_id
# and require_tenant — which only applies to models declaring acts_as_tenant —
# never blocks a query on it.
class JobOpening < ApplicationRecord
  LIST_FIELDS = %i[responsibilities requirements nice_to_have growth_items].freeze
  DEFAULT_GROWTH_HEADING = "What you'll learn".freeze
  EMPLOYMENT_TYPES = [ "Full-time", "Part-time", "Internship", "Contract" ].freeze

  # Generous enough for the website's longest copy, tight enough to catch a
  # paste of the wrong thing.
  LIMITS = {
    code: 40, slug: 100, title: 150, category: 60, employment_type: 60, location: 120,
    summary: 500, intro: 1_000, about: 4_000, growth_heading: 120, role_question: 500
  }.freeze
  LIST_ITEM_LIMIT = 500
  LIST_SIZE_LIMIT = 20

  CODE_FORMAT = /\A[A-Z0-9]+(?:-[A-Z0-9]+)*\z/
  SLUG_FORMAT = /\A[a-z0-9]+(?:-[a-z0-9]+)*\z/

  # The column's CURRENT_DATE default only applies to an INSERT that leaves it
  # out, which Active Record never does — so the same default, in Ruby.
  attribute :date_posted, :date, default: -> { Date.current }

  normalizes :code, with: ->(code) { code.strip.upcase }
  normalizes :slug, with: ->(slug) { slug.strip.downcase }
  normalizes :title, :category, :employment_type, :location, :growth_heading, :role_question,
             with: ->(value) { value.strip }

  scope :ordered, -> { order(:sort_order, date_posted: :desc, id: :asc) }
  scope :active, -> { where(is_active: true) }

  before_validation :strip_list_items
  # Blank means "work it out": a new opening saved without them gets the same
  # code and slug the form would have suggested.
  before_validation :fill_identifiers

  validates :code, :slug, :title, :category, :employment_type, :location,
            :summary, :intro, :about, :growth_heading, :date_posted, presence: true
  validates :code, uniqueness: { case_sensitive: false, message: "is already used by another opening" }, format: {
    with: CODE_FORMAT, message: "can only use letters, numbers and single hyphens", allow_blank: true
  }
  validates :slug, uniqueness: { case_sensitive: false, message: "is already used by another opening" }, format: {
    with: SLUG_FORMAT, message: "can only use lowercase letters, numbers and single hyphens", allow_blank: true
  }
  LIMITS.each { |field, max| validates field, length: { maximum: max } }
  validates :sort_order, numericality: { only_integer: true }
  validate :lists_are_strings

  private
    # Blank lines from the form are dropped rather than refused. Anything that
    # isn't a list of strings is left as it is for lists_are_strings to report.
    def strip_list_items
      LIST_FIELDS.each do |field|
        items = self[field]
        next unless items.is_a?(Array) && items.all?(String)

        self[field] = items.map(&:strip).reject(&:empty?)
      end
    end

    def fill_identifiers
      self.code = JobOpenings::Identifiers.code_for(title, category, except_id: id) if code.blank? && title.present?
      self.slug = JobOpenings::Identifiers.slug_for(title, except_id: id) if slug.blank? && title.present?
    end

    def lists_are_strings
      LIST_FIELDS.each do |field|
        items = self[field]
        if !items.is_a?(Array) || !items.all?(String)
          errors.add(field, "must be a list of text items")
        elsif items.size > LIST_SIZE_LIMIT
          errors.add(field, "can have at most #{LIST_SIZE_LIMIT} items")
        elsif items.any? { |item| item.length > LIST_ITEM_LIMIT }
          errors.add(field, "items can be at most #{LIST_ITEM_LIMIT} characters each")
        end
      end
    end
end
