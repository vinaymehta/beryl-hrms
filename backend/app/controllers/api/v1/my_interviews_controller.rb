module Api
  module V1
    # "My interviews" — the interviews the signed-in user ran, and the in-app
    # way to write them up. Deliberately NOT behind recruitment permission:
    # being the assigned interviewer is the whole entitlement, so every lookup
    # is pinned to interviewer_id = the user's own Employee and nothing else.
    #
    # The payload is what an interviewer needs to prepare: who, which role,
    # when, the candidate's profile, the AI questions and their own feedback —
    # plus the resume, which the booking mail already sends them. Never contact
    # details (email, phone), ATS score, match % or eligibility.
    class MyInterviewsController < BaseController
      before_action :set_interview, only: %i[feedback resume]

      # GET /api/v1/my_interviews
      def index
        render json: { data: own_interviews.order(interview_at: :desc).map { |c| payload(c) } }
      end

      # POST /api/v1/my_interviews/:id/feedback
      def feedback
        attributes = ::Recruitment::InterviewFeedbackFields.attributes_from(params)

        if @interview.submit_feedback(attributes)
          render json: { data: payload(@interview) }
        else
          render json: { errors: @interview.errors.full_messages.map { |m| { message: m } } },
                 status: :unprocessable_content
        end
      end

      # GET /api/v1/my_interviews/:id/resume
      def resume
        file = ::Recruitment::InterviewDetails.current_resume(@interview)
        unless file&.file&.attached?
          return render json: { errors: [ { message: "No resume is on file for this candidate." } ] }, status: :not_found
        end

        send_data file.file.download,
                  filename: file.file_name.presence || "resume.pdf",
                  type: file.content_type.presence || "application/octet-stream",
                  disposition: "attachment"
      end

      private

        # A login with no Employee record has interviewed nobody — an empty
        # list, not an error.
        def own_interviews
          employee_id = Current.user.employee_record&.id
          return Candidate.none if employee_id.nil?

          Candidate.where(interviewer_id: employee_id).where.not(interview_at: nil)
                   .includes(*::Recruitment::InterviewDetails::PRELOADS)
        end

        # Someone else's candidate is a 404, the same as one that doesn't exist.
        def set_interview
          @interview = own_interviews.find(params[:id])
        end

        def payload(candidate)
          {
            id: candidate.id.to_s,
            candidateName: candidate.name,
            jobTitle: ::Recruitment::InterviewDetails.job_title(candidate),
            interviewAt: candidate.interview_at&.in_time_zone("Asia/Kolkata")&.iso8601,
            joinUrl: candidate.calendly_join_url,
            hasResume: candidate.candidate_resumes.any?,
            interviewStatus: ::Recruitment::InterviewFeedbackFields.interview_status(candidate),
            profile: ::Recruitment::InterviewDetails.profile(candidate),
            interviewQuestions: ::Recruitment::InterviewDetails.questions(candidate),
            feedback: ::Recruitment::InterviewFeedbackFields.payload(candidate)
          }
        end
    end
  end
end
