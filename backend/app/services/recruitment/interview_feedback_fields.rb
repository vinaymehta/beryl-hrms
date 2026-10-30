module Recruitment
  # The structured interviewer feedback, in and out — shared by the public
  # token form, the in-app My interviews page and the admin Interviews
  # dashboard so all three read and write exactly the same fields.
  module InterviewFeedbackFields
    # camelCase request key => candidate column.
    PARAMS = {
      technicalRating: :feedback_technical_rating,
      communicationRating: :feedback_communication_rating,
      problemSolvingRating: :feedback_problem_solving_rating,
      cultureFitRating: :feedback_culture_fit_rating,
      overallRating: :feedback_rating,
      decision: :feedback_decision
    }.freeze

    TEXT_PARAMS = {
      strengths: :feedback_strengths,
      weaknesses: :feedback_weaknesses,
      comments: :feedback_comments
    }.freeze

    TEXT_LIMIT = 2000

    module_function

    # Attributes for Candidate#submit_feedback. Blank decision becomes nil so
    # the presence check reports it, rather than the enum rejecting "".
    def attributes_from(params)
      attrs = PARAMS.to_h { |key, column| [ column, params[key].presence ] }
      TEXT_PARAMS.each { |key, column| attrs[column] = params[key].to_s.strip.first(TEXT_LIMIT).presence }
      attrs
    end

    # What was submitted. Old rows carry only rating/wouldRecommend/comments;
    # every other field is simply null for them.
    def payload(candidate)
      {
        submittedAt: candidate.feedback_submitted_at&.iso8601,
        technicalRating: candidate.feedback_technical_rating,
        communicationRating: candidate.feedback_communication_rating,
        problemSolvingRating: candidate.feedback_problem_solving_rating,
        cultureFitRating: candidate.feedback_culture_fit_rating,
        overallRating: candidate.feedback_rating,
        decision: candidate.feedback_decision,
        wouldRecommend: candidate.feedback_would_recommend,
        strengths: candidate.feedback_strengths,
        weaknesses: candidate.feedback_weaknesses,
        comments: candidate.feedback_comments
      }
    end

    # Where the interview stands, derived from its timestamps rather than the
    # candidate status, which an admin can move by hand:
    #   upcoming          — booked for a time still ahead
    #   feedback_pending  — held (or undated) and nothing written up yet
    #   feedback_received — the interviewer has submitted
    def interview_status(candidate, now: Time.current)
      return "feedback_received" if candidate.feedback_submitted?
      return "upcoming" if candidate.interview_at.present? && candidate.interview_at > now

      "feedback_pending"
    end
  end
end
