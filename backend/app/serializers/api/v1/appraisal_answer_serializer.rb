module Api
  module V1
    class AppraisalAnswerSerializer < ApplicationSerializer
      attributes :id, :appraisal_template_question_id, :comment

      # A decimal column (half-star ratings), and a BigDecimal goes out as the
      # STRING "3.5" — the client compares and averages ratings as numbers.
      attribute :rating do |answer|
        answer.rating&.to_f
      end
    end
  end
end
