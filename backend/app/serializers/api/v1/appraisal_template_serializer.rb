module Api
  module V1
    class AppraisalTemplateSerializer < ApplicationSerializer
      attributes :id, :name, :description, :status, :version, :lineage_id, :created_at

      # Frozen once a cycle has started against it — the UI reads this to offer
      # "new version" instead of "edit".
      attribute :in_use, &:in_use?
      attribute :total_weight do |template|
        template.categories.sum { |category| category.weight.to_d }.to_f
      end

      many :categories, resource: Api::V1::AppraisalTemplateCategorySerializer
    end
  end
end
