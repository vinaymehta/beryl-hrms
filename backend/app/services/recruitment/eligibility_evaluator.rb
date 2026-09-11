module Recruitment
  # Deterministic (no AI) evaluation of the four hiring-eligibility criteria.
  #
  # Every rule here is intentionally explicit, because the input is whatever
  # an AI managed to read off an arbitrarily-formatted resume: the same
  # candidate can be described as "MCA", "M.C.A." or "Master of Computer
  # Applications", and marks can arrive as a percentage, a CGPA, or a CGPA
  # accidentally written into the percentage field. Ambiguity is resolved
  # here, once, rather than being left to the extraction step — so the same
  # resume always produces the same verdict.
  #
  # Three of the criteria are tri-state: true (positively confirmed pass),
  # false (positively confirmed fail), nil (missing/unreadable — never
  # guessed into a pass or a fail). Backlogs are the deliberate exception:
  # resumes almost never say "no backlogs", so silence there means "none"
  # (see #backlog_pass).
  #
  # The automatic pipeline shortlists only when all four are true; anything
  # else is rejected.
  class EligibilityEvaluator
    Result = Struct.new(:qualification, :marks, :graduation_year, :backlog, :match_percentage, :status, keyword_init: true)

    # Marks must be ABOVE this, so exactly 60% is a fail.
    MARKS_THRESHOLD = 60

    # CBSE's standard conversion, the one most Indian marksheets print.
    # Single source of truth — changing this changes every marks decision.
    CGPA_TO_PERCENTAGE_FACTOR = 9.5

    # Above this a number cannot be a CGPA, so it is read as a percentage
    # (and vice versa). This is how a value in the wrong field is recovered
    # without inventing anything: the number itself is unchanged, only the
    # unit it can sensibly be expressed in is resolved.
    MAX_CGPA = 10.0

    # A year outside this window is unreadable data (an OCR artifact, a
    # duration mistaken for a year), not a confirmed failure.
    EARLIEST_PLAUSIBLE_YEAR = 1950
    FUTURE_YEAR_ALLOWANCE = 10

    # The accepted qualification set is exactly: BCA, MCA, B.Tech and
    # M.Tech — the last two only in CSE, IT or Computer Engineering.
    #
    # BCA/MCA qualify on their own: the degree name already names the
    # field ("Computer Applications"), and real BCA/MCA resumes almost
    # never print a separate branch, so requiring one would fail nearly
    # every genuine candidate. Abbreviations are matched case-sensitively
    # so prose can't trip them.
    STANDALONE_DEGREE_PATTERNS = [
      /\bBCA\b/,
      /\bMCA\b/,
      /\bB\.C\.A\.?/i,
      /\bM\.C\.A\.?/i,
      /\b(?:bachelor|master)(?:'?s)?\s+(?:of|in)\s+computer\s+applications?\b/i
    ].freeze

    # Broad degree types that only qualify when paired with an accepted
    # field of study — "M.Tech Cybersecurity" is a M.Tech, but not ours.
    # Deliberately only B.Tech/M.Tech: B.E., M.E., B.Sc and M.Sc are NOT
    # accepted degree families, whatever field they are paired with.
    FIELD_REQUIRING_DEGREE_PATTERNS = [
      /\bB\.?\s?Tech\b/i,
      /\bM\.?\s?Tech\b/i,
      /\b(?:bachelor|master)(?:'?s)?\s+(?:of|in)\s+technology\b/i
    ].freeze

    # Accepted fields of study: CSE, IT and Computer Engineering, each
    # matched by both its abbreviation and its spelled-out form, since a
    # resume may print either. Abbreviations are case-sensitive on purpose:
    # a lowercase "it" is the English word, not Information Technology.
    ACCEPTED_FIELD_PATTERNS = [
      /\bCSE\b/,
      /\bCS\b/,
      /\bIT\b/,
      /\bcomputer\s+science\b/i,
      /\bcomputer\s+engineering\b/i,
      /\binformation\s+technology\b/i
    ].freeze

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
      status = criteria.values.all? { |v| v == true } ? :shortlisted : :rejected

      Result.new(**criteria, match_percentage: match_percentage, status: status)
    end

    private

    # --- Criteria -----------------------------------------------------

    # Holding an accepted qualification at any level is a pass — a later
    # unrelated degree (an MBA after a B.Tech CSE) doesn't disqualify the
    # one that counts.
    def qualification_pass
      return nil if qualifications.empty?

      accepted_qualifications.any?
    end

    def marks_pass
      percentage = effective_percentage
      return nil if percentage.nil?

      percentage > MARKS_THRESHOLD
    end

    # Read off the same qualification the qualification criterion relies on
    # (the latest accepted one), so the two answers can never describe two
    # different degrees. An in-progress degree counts as its stated end
    # year, which is exactly what year_completed holds for it.
    def graduation_year_pass
      year = selected_qualification&.dig(:year) || plausible_year(@candidate.graduation_year)
      return nil if year.nil?

      [ Date.current.year, Date.current.year - 1 ].include?(year)
    end

    # Resumes state backlogs only when there are some — "no backlogs" is
    # almost never written out. Treating silence as unknown would fail
    # nearly every real candidate, so only an explicit mention of pending
    # backlogs/arrears fails here.
    def backlog_pass
      @candidate.active_backlogs != true
    end

    # --- Qualification selection --------------------------------------

    # Every qualification on file, as { text:, year: } — degree and field
    # joined because either one can carry the field ("B.Tech Computer
    # Science" vs degree "B.Tech" + field "Computer Science").
    def qualifications
      @qualifications ||= begin
        rows = structured_qualification_rows.map do |q|
          { text: [ q.degree, q.field_of_study ].compact_blank.join(" ").strip, year: plausible_year(q.year_completed) }
        end
        rows.reject! { |q| q[:text].blank? }
        rows.presence || flattened_qualification
      end
    end

    # Reloaded rather than read from the association cache: the extraction
    # job rewrites these rows immediately before evaluating.
    def structured_qualification_rows
      return @candidate.candidate_qualifications.to_a unless @candidate.persisted?

      @candidate.candidate_qualifications.reload.to_a
    end

    # Fallback for candidates whose structured qualifications were never
    # captured — the single flattened string the AI picked is all there is.
    def flattened_qualification
      text = @candidate.highest_qualification.to_s.strip
      return [] if text.blank?

      [ { text: text, year: plausible_year(@candidate.graduation_year) } ]
    end

    def accepted_qualifications
      @accepted_qualifications ||= qualifications.select { |q| accepted?(q[:text]) }
    end

    # The latest accepted qualification drives both criteria; with none
    # accepted, the latest of any kind still gives the graduation-year
    # criterion something deterministic to read.
    def selected_qualification
      return @selected_qualification if defined?(@selected_qualification)

      @selected_qualification = latest(accepted_qualifications.presence || qualifications)
    end

    # Dated qualifications outrank undated ones; the newest year wins, and
    # ties fall back to the order they were listed so the result is stable.
    def latest(list)
      list.each_with_index.max_by { |q, index| [ q[:year] ? 1 : 0, q[:year] || 0, -index ] }&.first
    end

    def accepted?(text)
      return true if STANDALONE_DEGREE_PATTERNS.any? { |p| p.match?(text) }

      FIELD_REQUIRING_DEGREE_PATTERNS.any? { |p| p.match?(text) } &&
        ACCEPTED_FIELD_PATTERNS.any? { |p| p.match?(text) }
    end

    # --- Marks --------------------------------------------------------

    # Resolves whatever was captured into a single percentage, accepting
    # that either field can hold either unit.
    def effective_percentage
      direct = as_percentage(@candidate.academic_percentage)
      return direct if direct

      cgpa = as_cgpa(@candidate.academic_cgpa) || as_cgpa(@candidate.academic_percentage)
      return (cgpa * CGPA_TO_PERCENTAGE_FACTOR).round(2) if cgpa

      # Last case: a percentage written into the CGPA field.
      as_percentage(@candidate.academic_cgpa)
    end

    def as_percentage(value)
      number = numeric(value)
      return nil if number.nil?

      number > MAX_CGPA && number <= 100 ? number : nil
    end

    def as_cgpa(value)
      number = numeric(value)
      return nil if number.nil?

      number.positive? && number <= MAX_CGPA ? number : nil
    end

    def numeric(value)
      return nil if value.nil?

      Float(value)
    rescue ArgumentError, TypeError
      nil
    end

    # --- Shared helpers -----------------------------------------------

    def plausible_year(value)
      year = Integer(value) rescue nil
      return nil if year.nil?

      year.between?(EARLIEST_PLAUSIBLE_YEAR, Date.current.year + FUTURE_YEAR_ALLOWANCE) ? year : nil
    end
  end
end
