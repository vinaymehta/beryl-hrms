module Api
  module V1
    # Restricted: only ever reached through Appraisals::DetailPresenter, which
    # includes it solely for a viewer holding appraisals.manage_compensation.
    class AppraisalCompensationDecisionSerializer < ApplicationSerializer
      attributes :id,
                 :current_compensation, :last_increment_percentage, :last_increment_on,
                 :recommended_increment_percentage, :recommended_compensation,
                 :approved_increment_percentage, :approved_compensation,
                 :effective_date, :management_comments,
                 :promotion_recommendation, :current_designation_id, :proposed_designation_id,
                 :promotion_reason, :promotion_effective_date, :new_responsibilities,
                 :updated_at

      attribute :any_decision, &:any_decision?
      attribute :updated_by do |decision|
        decision.actor_user&.full_name
      end
      attribute :current_designation_title do |decision|
        decision.current_designation&.title
      end
      attribute :proposed_designation_title do |decision|
        decision.proposed_designation&.title
      end
    end
  end
end
