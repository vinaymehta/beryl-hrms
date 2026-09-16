class Document < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  # Nullable — some documents (a company policy PDF, say) aren't tied to any
  # one employee; company-wide documents belong to the company alone.
  belongs_to :employee, optional: true
  belongs_to :uploaded_by, class_name: "User"
  has_one_attached :file

  OTHER_CATEGORY = "other".freeze

  # Stored as stable machine keys, never the display text: renaming a label in
  # the UI must not orphan every row filed under the old wording. The frontend
  # owns the human-readable names.
  #
  # Held in document_type (the column that already existed and is already
  # serialized and indexed) rather than a second, overlapping "category"
  # column meaning the same thing.
  CATEGORIES = %w[
    aadhaar
    pan
    resume
    offer_letter
    employment_contract
    education_certificate
    experience_certificate
    bank_document
    other
  ].freeze

  validates :title, :document_type, presence: true
  validates :document_type, inclusion: { in: CATEGORIES, message: "is not a valid document category" }

  # "Other" without a name is just an unlabelled pile — the whole point of
  # choosing it is to say what the document actually is.
  validates :custom_category,
            presence: { message: "is required when the category is Other" },
            if: -> { document_type == OTHER_CATEGORY }

  # A category that names itself can't also carry a bespoke name, or the two
  # disagree and the list has to guess which to show.
  validates :custom_category,
            absence: { message: "only applies when the category is Other" },
            unless: -> { document_type == OTHER_CATEGORY }

  # title is required, but asking someone to type a name for a file they just
  # picked is busywork — the filename already is one. Uploads previously failed
  # validation outright because the client never sent a title at all.
  before_validation :default_title_from_file

  # What to show in a list: the custom name for "Other", the category key
  # otherwise (the client maps keys to labels).
  def category_label
    document_type == OTHER_CATEGORY ? custom_category.presence || "Other" : document_type
  end

  private

    def default_title_from_file
      return if title.present?
      return unless file.attached?

      self.title = file.filename.to_s
    end
end
