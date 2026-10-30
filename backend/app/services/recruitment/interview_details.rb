module Recruitment
  # Everything about an interview beyond the feedback itself: the role it was
  # for, where it stands, the candidate's profile and the AI questions. Shared
  # by the admin Interviews dashboard and My interviews so both name the role
  # and describe the candidate the same way.
  #
  # Works in memory over PRELOADS — no query per row.
  module InterviewDetails
    ZONE = "Asia/Kolkata".freeze
    SKILL_LIMIT = 15

    PRELOADS = [
      :interview_questions_job, :candidate_skills, :candidate_qualifications,
      :candidate_experiences, :candidate_resumes, { candidate_job_matches: :job }
    ].freeze

    module_function

    # The job the questions were written for, else the best job match, else
    # the role on the candidate's own resume.
    def job_title(candidate)
      candidate.interview_questions_job&.title ||
        candidate.candidate_job_matches.max_by(&:match_score)&.job&.title ||
        candidate.current_role
    end

    # Where the interview itself stands (the feedback has its own timestamps):
    #   completed      — held, or written up
    #   today          — on today's IST date
    #   scheduled      — booked for a later day
    #   not_booked     — interviewer assigned, no slot yet
    #   no_interviewer — nobody to run it, so nobody owes feedback either
    def stage(candidate, now: Time.current)
      return "completed" if candidate.feedback_submitted?
      return "no_interviewer" if candidate.interviewer_id.nil?
      return "not_booked" if candidate.interview_at.nil?
      return "today" if candidate.interview_at.in_time_zone(ZONE).to_date == now.in_time_zone(ZONE).to_date

      candidate.interview_at > now ? "scheduled" : "completed"
    end

    # What an interviewer reads before the call. Deliberately no contact
    # details or scores — the admin row adds those itself.
    def profile(candidate)
      current = current_experience(candidate)
      {
        experienceYears: candidate.experience_years.to_f,
        currentRole: candidate.current_role.presence || current&.job_title,
        currentCompany: current&.company_name,
        location: candidate.current_location.presence || candidate.city,
        education: education(candidate),
        skills: candidate.candidate_skills.sort_by { |s| -s.confidence.to_f }.first(SKILL_LIMIT).map(&:name)
      }
    end

    # Camelised by hand: a plain Hash out of a JSONB column never passes
    # through the serializer's key transform.
    def questions(candidate)
      Array(candidate.interview_questions).map { |q| q.to_h.transform_keys { |key| key.to_s.camelize(:lower) } }
    end

    # The same file the My interviews resume download serves.
    def current_resume(candidate)
      candidate.candidate_resumes.max_by { |r| [ r.is_current ? 1 : 0, r.created_at ] }
    end

    def current_experience(candidate)
      experiences = candidate.candidate_experiences
      experiences.find(&:is_current) ||
        experiences.max_by { |e| e.end_date || e.start_date || Date.new(1900) }
    end

    def education(candidate)
      best = candidate.candidate_qualifications.max_by { |q| q.year_completed.to_i }
      return candidate.highest_qualification.presence if best.nil?

      degree = [ best.degree, best.field_of_study ].compact_blank.uniq.join(", ")
      institution = [ best.institution, best.year_completed ].compact_blank.join(", ")
      [ degree, institution ].compact_blank.join(" · ")
    end
  end
end
