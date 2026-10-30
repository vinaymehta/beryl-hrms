module Recruitment
  # The admin Interviews page: the filtered, paginated list of every interview
  # and the numbers above it. One interview per candidate, so an "interview"
  # here is a candidate row with an interview on it (Candidate.with_interview).
  #
  # Takes an already tenant- and policy-scoped relation; nothing in here widens
  # it.
  class InterviewDashboard
    PER_PAGE = 20
    TABS = %w[today upcoming completed awaiting_feedback].freeze
    ZONE = InterviewDetails::ZONE
    # Unanswered this long after the request (or the interview, if the request
    # never went out) counts as overdue.
    OVERDUE_AFTER = 1.day

    def initialize(scope, now: Time.current)
      @scope = scope.with_interview
      @now = now
    end

    # filters: tab, q, interviewerId, jobId, from, to (YYYY-MM-DD, IST days),
    # candidateId (one interview, for a link that opens its panel).
    # meta.counts are per tab under the other filters, for the tab badges.
    def list(filters, page: 1)
      base = filter(filters)
      relation = tab_scope(filters[:tab], base)
      page = [ page.to_i, 1 ].max
      total = relation.count
      rows = relation.includes(:interviewer, *InterviewDetails::PRELOADS)
                     .order(Arel.sql(order_for(filters[:tab])))
                     .offset((page - 1) * PER_PAGE)
                     .limit(PER_PAGE)

      {
        data: rows.map { |candidate| row(candidate) },
        meta: {
          page: page, perPage: PER_PAGE, totalCount: total, totalPages: (total.to_f / PER_PAGE).ceil,
          counts: tab_counts(base)
        }
      }
    end

    # Company-wide — the filters only narrow the table.
    def stats
      awaiting = tab_scope("awaiting_feedback")
      decided = @scope.where.not(feedback_submitted_at: nil)

      {
        thisWeek: @scope.where(interview_at: @now.in_time_zone(ZONE).all_week).count,
        completed: tab_scope("completed").count,
        awaitingFeedback: awaiting.count,
        overdueFeedback: overdue(awaiting).count,
        hired: decided.where(feedback_decision: :hire).count,
        avgRating: decided.average(:feedback_rating)&.to_f&.round(1),
        interviewers: interviewers
      }
    end

    private

      def filter(filters)
        relation = @scope
        relation = search(relation, filters[:q]) if filters[:q].present?
        relation = relation.where(interviewer_id: filters[:interviewerId]) if filters[:interviewerId].present?
        relation = relation.where(id: filters[:candidateId]) if filters[:candidateId].present?
        relation = for_job(relation, filters[:jobId]) if filters[:jobId].present?

        from = parse_day(filters[:from])
        to = parse_day(filters[:to])
        relation = relation.where(interview_at: from.beginning_of_day..) if from
        relation = relation.where(interview_at: ..to.end_of_day) if to
        relation
      end

      # Name, email, the candidate's own role, or the job they interviewed for.
      def search(relation, query)
        term = "%#{ActiveRecord::Base.sanitize_sql_like(query.to_s.strip.downcase)}%"
        relation.where(
          "LOWER(candidates.full_name) LIKE :t
           OR LOWER(CONCAT_WS(' ', candidates.first_name, candidates.last_name)) LIKE :t
           OR LOWER(candidates.email) LIKE :t
           OR LOWER(candidates.\"current_role\") LIKE :t
           OR EXISTS (SELECT 1 FROM jobs qj WHERE qj.id = candidates.interview_questions_job_id AND LOWER(qj.title) LIKE :t)
           OR EXISTS (
             SELECT 1 FROM candidate_job_matches cjm JOIN jobs mj ON mj.id = cjm.job_id
             WHERE cjm.candidate_id = candidates.id AND LOWER(mj.title) LIKE :t
           )",
          t: term
        )
      end

      # The interview's role is the job its questions were written for, else
      # any job the candidate was matched against.
      def for_job(relation, job_id)
        relation.where(
          "candidates.interview_questions_job_id = :job OR EXISTS (
            SELECT 1 FROM candidate_job_matches cjm
            WHERE cjm.candidate_id = candidates.id AND cjm.job_id = :job
          )",
          job: job_id.to_i
        )
      end

      # The quick tabs. They overlap on purpose (today's 10am interview is both
      # Today and Completed by noon); only "all" is the whole list. Same rules
      # as InterviewDetails.stage, in SQL.
      def tab_scope(tab, relation = @scope)
        case tab.to_s
        when "today"
          relation.where(interview_at: @now.in_time_zone(ZONE).all_day)
        when "upcoming"
          relation.where("candidates.interview_at > ?", @now)
        when "completed"
          relation.where.not(feedback_submitted_at: nil).or(
            relation.where.not(interviewer_id: nil).where("candidates.interview_at <= ?", @now)
          )
        when "awaiting_feedback"
          # No interviewer means nobody owes feedback — not pending.
          relation.where(feedback_submitted_at: nil).where.not(interviewer_id: nil)
                  .where("candidates.interview_at IS NULL OR candidates.interview_at <= ?", @now)
        else
          relation
        end
      end

      def tab_counts(base)
        {
          all: base.count,
          today: tab_scope("today", base).count,
          upcoming: tab_scope("upcoming", base).count,
          completed: tab_scope("completed", base).count,
          awaitingFeedback: tab_scope("awaiting_feedback", base).count
        }
      end

      def overdue(awaiting)
        cutoff = @now - OVERDUE_AFTER
        awaiting.where(
          "candidates.feedback_requested_at < :cutoff
           OR (candidates.feedback_requested_at IS NULL AND candidates.interview_at < :cutoff)",
          cutoff: cutoff
        )
      end

      # Soonest first when looking ahead; most recent first otherwise.
      def order_for(tab)
        if %w[today upcoming].include?(tab.to_s)
          "candidates.interview_at ASC NULLS LAST, candidates.id ASC"
        else
          "candidates.interview_at DESC NULLS LAST, candidates.id DESC"
        end
      end

      # Everyone with an interview here, for the Interviewer filter.
      def interviewers
        ids = @scope.where.not(interviewer_id: nil).distinct.pluck(:interviewer_id)
        Employee.where(id: ids).map { |e| { id: e.id.to_s, name: e.full_name } }.sort_by { |i| i[:name].to_s }
      end

      def parse_day(value)
        return if value.blank?

        Time.find_zone(ZONE).parse(value.to_s)&.to_date&.in_time_zone(ZONE)
      rescue ArgumentError
        nil
      end

      def row(candidate)
        resume = InterviewDetails.current_resume(candidate)
        {
          id: candidate.id.to_s,
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          candidatePhone: candidate.phone,
          candidateStatus: candidate.status,
          jobTitle: InterviewDetails.job_title(candidate),
          interviewerId: candidate.interviewer_id&.to_s,
          interviewerName: candidate.interviewer&.full_name,
          interviewAt: candidate.interview_at&.in_time_zone(ZONE)&.iso8601,
          interviewStage: InterviewDetails.stage(candidate, now: @now),
          joinUrl: candidate.calendly_join_url,
          interviewLinkSentAt: candidate.interview_link_sent_at&.iso8601,
          feedbackRequestedAt: candidate.feedback_requested_at&.iso8601,
          feedbackReminderSentAt: candidate.feedback_reminder_sent_at&.iso8601,
          atsScore: resume&.ats_score,
          matchPercentage: resume&.criteria_match_percentage,
          resumeId: resume&.id&.to_s,
          profile: InterviewDetails.profile(candidate),
          interviewQuestions: InterviewDetails.questions(candidate),
          feedback: InterviewFeedbackFields.payload(candidate)
        }
      end
  end
end
