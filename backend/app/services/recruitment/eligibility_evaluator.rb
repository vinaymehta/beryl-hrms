module Recruitment
  # Deterministic (no AI) evaluation of the four hiring-eligibility criteria.
  # Every criterion is tri-state: true (positively confirmed pass), false
  # (positively confirmed fail), or nil (missing/unreadable — never guessed
  # into a pass or a fail). The automatic pipeline only ever routes a
  # candidate to :shortlisted (all four true) or :needs_review (anything
  # else, including a confirmed fail) — Rejected stays a manual HR action.
  class EligibilityEvaluator
    Result = Struct.new(:qualification, :marks, :graduation_year, :backlog, :match_percentage, :status, keyword_init: true)

    # BCA is a self-contained accepted qualification — it does not need a
    # CSE/IT/Computer Engineering field suffix. B.Tech/M.Tech are broad
    # degree types that only qualify when paired with an accepted field.
    STANDALONE_DEGREE_PATTERN = /\bbca\b/i
    FIELD_REQUIRING_DEGREE_PATTERN = /\bb\.?\s*tech\b|\bm\.?\s*tech\b/i
    ACCEPTED_FIELD_PATTERN = /\bcse\b|\bcomputer\s+science\b|\binformation\s+technology\b|\bit\b|\bcomputer\s+engineering\b/i

    def self.call(candidate)
      new(candidate).call
    end

    def initialize(candidate)
      @candidate = candidate
    end

    def call
      criteria = {
        qualification: qualification_pass,
        marks: marks_pass,
        graduation_year: graduation_year_pass,
        backlog: backlog_pass
      }
      confirmed_count = criteria.values.count { |v| v == true }
      match_percentage = (confirmed_count / 4.0 * 100).round
      status = criteria.values.all? { |v| v == true } ? :shortlisted : :needs_review

      Result.new(**criteria, match_percentage: match_percentage, status: status)
    end

    private

    def qualification_pass
      text = @candidate.highest_qualification.to_s.strip
      return nil if text.blank?
      return true if STANDALONE_DEGREE_PATTERN.match?(text)
      return true if FIELD_REQUIRING_DEGREE_PATTERN.match?(text) && ACCEPTED_FIELD_PATTERN.match?(text)

      false
    end

    def marks_pass
      # CGPA-only resumes (academic_percentage nil) are unconfirmed, not a
      # pass — no reliable CGPA-to-percentage conversion exists anywhere in
      # this codebase, and the spec forbids inventing one.
      percentage = @candidate.academic_percentage
      return nil if percentage.nil?
      percentage.to_f > 60
    end

    def graduation_year_pass
      year = @candidate.graduation_year
      return nil if year.nil?
      [Date.current.year, Date.current.year - 1].include?(year)
    end

    def backlog_pass
      case @candidate.active_backlogs
      when false then true
      when true then false
      else nil
      end
    end
  end
end
