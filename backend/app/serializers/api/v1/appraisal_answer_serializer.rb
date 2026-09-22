module Api
  module V1
    class AppraisalAnswerSerializer < ApplicationSerializer
      attributes :id, :appraisal_template_question_id, :rating, :comment
    end
  end
end
