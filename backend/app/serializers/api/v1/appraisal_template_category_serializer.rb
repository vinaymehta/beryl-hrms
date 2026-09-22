module Api
  module V1
    class AppraisalTemplateCategorySerializer < ApplicationSerializer
      attributes :id, :name, :description, :lens, :weight, :position

      many :questions, resource: Api::V1::AppraisalTemplateQuestionSerializer
    end
  end
end
