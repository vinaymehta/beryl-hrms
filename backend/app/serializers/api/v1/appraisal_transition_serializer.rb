module Api
  module V1
    class AppraisalTransitionSerializer < ApplicationSerializer
      attributes :id, :notes, :created_at

      attribute :from_status, &:from_status_name
      attribute :to_status, &:to_status_name
      attribute :actor_name do |transition|
        transition.actor_user&.full_name
      end
    end
  end
end
