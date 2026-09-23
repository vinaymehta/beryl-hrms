module Api
  module V1
    class AppraisalTemplateSerializer < ApplicationSerializer
      attributes :id, :name, :description, :status, :version, :lineage_id, :created_at

      # The imported workbook's own sections — see the `structure` migration.
      #
      # Camelised by hand: Alba's `transform_keys` rewrites the attribute names
      # it generates, not the keys inside a Hash an attribute block returns.
      # Without this the column round-trips inconsistently, because the inbound
      # side (config/initializers/json_key_transform.rb) underscores everything
      # on the way in — so the client would post `ratingGuide` and read back
      # `rating_guide`.
      attribute :structure do |template|
        template.structure.deep_transform_keys { |key| key.to_s.camelize(:lower) }
      end

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
