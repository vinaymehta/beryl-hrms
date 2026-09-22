module Api
  module V1
    class AppraisalScoreOverrideSerializer < ApplicationSerializer
      attributes :id, :previous_score, :new_score, :reason, :created_at

      attribute :actor_name do |override|
        override.actor_user&.full_name
      end
    end
  end
end
