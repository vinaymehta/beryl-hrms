module Api
  module V1
    class AppraisalCommentSerializer < ApplicationSerializer
      attributes :id, :body, :visibility, :appraisal_revision_id, :created_at

      attribute :author_name do |comment|
        comment.author_user&.full_name
      end
    end
  end
end
