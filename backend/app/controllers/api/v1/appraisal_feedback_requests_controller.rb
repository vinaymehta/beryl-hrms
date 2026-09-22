module Api
  module V1
    # Optional 360° feedback (§21). Nested under the appraisal, because a
    # request only means anything in the context of one.
    #
    # Nothing in the workflow waits on these: the scope says peer feedback must
    # not be mandatory initially, so an unanswered request never blocks a
    # transition.
    class AppraisalFeedbackRequestsController < Api::V1::BaseController
      # Skipped for #respond_to_request: the person asked for feedback is not a
      # reviewer on that appraisal, so loading it through AppraisalPolicy::Scope
      # would 404 before they could answer. The request record is its own
      # authorization anchor — AppraisalFeedbackRequestPolicy::Scope already
      # restricts it to the person it was addressed to.
      before_action :load_appraisal, except: :respond_to_request

      def index
        authorize AppraisalFeedbackRequest
        requests = policy_scope(AppraisalFeedbackRequest).where(appraisal_id: @appraisal.id).newest_first
        render_data(requests.map { |request| payload(request) })
      end

      def create
        authorize AppraisalFeedbackRequest
        request_record = @appraisal.feedback_requests.create!(
          requested_from_id: params[:requested_from_id],
          prompt: params[:prompt],
          visibility: params[:visibility].presence || "management_only",
          requested_by: Current.user
        )
        ::Audit::Record.call(action: "appraisal_feedback.requested", auditable: request_record, request: request)
        render_data(payload(request_record), status: :created)
      end

      # Only the person asked may answer, and only while it is still pending.
      def respond_to_request
        feedback = policy_scope(AppraisalFeedbackRequest).find(params[:id])
        authorize feedback, :respond?
        feedback.submit!(params[:response])
        ::Audit::Record.call(action: "appraisal_feedback.submitted", auditable: feedback, request: request)
        render_data(payload(feedback))
      end

      def destroy
        feedback = policy_scope(AppraisalFeedbackRequest).find(params[:id])
        authorize feedback
        feedback.destroy!
        head :no_content
      end

      private
        def load_appraisal
          @appraisal = policy_scope(Appraisal).find(params[:appraisal_id])
        end

        def payload(record)
          record.as_json(methods: [])
                .merge("requestedFromName" => record.requested_from&.full_name)
                .deep_transform_keys { |key| key.to_s.camelize(:lower) }
        end
    end
  end
end
