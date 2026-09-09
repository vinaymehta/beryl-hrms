class CandidateSkill < ApplicationRecord
  acts_as_tenant(:company)

  CATEGORIES = %w[programming_language framework tool database cloud domain other].freeze

  belongs_to :company
  belongs_to :candidate

  validates :name, presence: true
  validates :category, inclusion: { in: CATEGORIES }, allow_blank: true
end
