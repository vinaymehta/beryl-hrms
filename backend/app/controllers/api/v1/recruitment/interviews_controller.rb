module Api
  module V1
    module Recruitment
      # The admin Interviews page. Same access as the rest of Recruitment, and
      # every number comes from policy_scope(Candidate), so it never reaches
      # past the user's own company.
      class InterviewsController < Api::V1::BaseController
        before_action :authorize_recruitment!

        # GET /api/v1/recruitment/interviews
        def index
          render json: dashboard.list(params.permit(:tab, :q, :interviewerId, :jobId, :from, :to), page: params[:page])
        end

        # GET /api/v1/recruitment/interviews/stats
        def stats
          render json: { data: dashboard.stats }
        end

        private

        def dashboard
          ::Recruitment::InterviewDashboard.new(policy_scope(Candidate))
        end

        def authorize_recruitment!
          authorize Candidate, :index?
        end
      end
    end
  end
end
