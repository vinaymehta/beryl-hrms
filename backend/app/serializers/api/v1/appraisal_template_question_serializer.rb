module Api
  module V1
    class AppraisalTemplateQuestionSerializer < ApplicationSerializer
      attributes :id, :prompt, :description, :position,
                 :self_rating, :manager_rating, :requires_comment, :required
    end
  end
end
