module Api
  module V1
    # One immutable version. Which revisions a given viewer receives at all is
    # decided upstream by AppraisalPolicy#visible_revision_stages — this only
    # shapes the ones already cleared.
    class AppraisalRevisionSerializer < ApplicationSerializer
      attributes :id, :version_number, :stage, :submitted_at, :calculated_score,
                 :summary, :achievements, :strengths, :improvement_areas,
                 :training_needs, :next_period_goals

      # Answers to the template's own fields. Keys are the workbook's, so this
      # is passed through rather than re-cased — the wizard looks them up by
      # the same key the template structure advertises.
      attribute :responses, &:responses

      attribute :label, &:label
      attribute :author_name do |revision|
        revision.author_employee&.full_name || revision.author_user&.full_name
      end

      many :answers, resource: Api::V1::AppraisalAnswerSerializer
    end
  end
end
