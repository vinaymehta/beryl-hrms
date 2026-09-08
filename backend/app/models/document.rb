class Document < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  # Nullable — some documents (a company policy PDF, say) aren't tied to any
  # one employee; company-wide documents belong to the company alone.
  belongs_to :employee, optional: true
  belongs_to :uploaded_by, class_name: "User"
  has_one_attached :file

  validates :title, :document_type, presence: true
end
