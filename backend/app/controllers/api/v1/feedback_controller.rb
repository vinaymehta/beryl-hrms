module Api
  module V1
    # PUBLIC endpoint — the candidate is an outside recipient with no account,
    # so there is no session, no tenant and no Pundit policy here. The
    # unguessable feedback_token is the entire credential, which is why:
    #   * lookup is by token only, never by candidate id;
    #   * a bad token returns the same 404 as an unknown one (no probing);
    #   * nothing internal is ever serialized back (no interviewer, no scores,
    #     no other candidates) — only what the candidate needs to see to
    #     recognize their own form.
    class FeedbackController < BaseController
      allow_unauthenticated_access only: %i[show create]
      skip_before_action :set_current_tenant, only: %i[show create]

      # GET /api/v1/feedback/:token
      def show
        candidate = find_by_token!(params[:token])

        render json: { data: form_payload(candidate) }
      end

      # POST /api/v1/feedback/:token
      def create
        candidate = find_by_token!(params[:token])

        if candidate.feedback_submitted?
          return render json: { errors: [ { message: "This feedback form has already been submitted." } ] },
                        status: :unprocessable_content
        end

        # Tenant is established from the record we just found by token — the
        # only safe source here, since there's no session to derive it from.
        ActsAsTenant.with_tenant(candidate.company) do
          candidate.assign_attributes(
            feedback_rating: params[:rating],
            feedback_would_recommend: params[:would_recommend],
            feedback_comments: params[:comments].to_s.strip.presence,
            feedback_submitted_at: Time.current,
            # Submitting IS the receipt — an admin shouldn't have to mark it
            # by hand once the candidate has actually answered.
            status: :feedback_received
          )

          unless candidate.save
            return render json: { errors: candidate.errors.full_messages.map { |m| { message: m } } },
                          status: :unprocessable_content
          end
        end

        render json: { data: form_payload(candidate) }
      end

      private

        # require_tenant is on globally, so an untenanted lookup has to be
        # explicit. Scoped to a single unique token, so this reads exactly one
        # row and can't leak across companies.
        def find_by_token!(token)
          candidate = ActsAsTenant.without_tenant do
            token.present? ? Candidate.find_by(feedback_token: token.to_s) : nil
          end
          raise ActiveRecord::RecordNotFound unless candidate

          candidate
        end

        # Deliberately minimal. First name only (enough for the candidate to
        # know the form is theirs), plus the company name so the page isn't
        # anonymous. Never the interviewer, the interview time, their status,
        # or anything about the hiring decision.
        def form_payload(candidate)
          {
            candidateFirstName: candidate.first_name.presence || candidate.full_name.to_s.split(/\s+/).first,
            companyName: ActsAsTenant.without_tenant { candidate.company&.name },
            submitted: candidate.feedback_submitted?,
            submittedAt: candidate.feedback_submitted_at&.iso8601,
            rating: candidate.feedback_rating,
            wouldRecommend: candidate.feedback_would_recommend,
            comments: candidate.feedback_comments
          }
        end
    end
  end
end
