module Ai
  # Twenty interview questions for one shortlisted candidate, grounded in their
  # resume and — when they were matched to one — the job they are up for.
  #
  # Unlike AtsScorer, this one RAISES. The distinction is who is waiting: ATS
  # scoring happens inside resume processing, where a failure must not take the
  # pipeline down, so it returns nil and the score is simply absent. This is
  # asked for by a person who has just clicked a button and is watching a
  # spinner, and an empty panel with no explanation is worse for them than an
  # error that says what went wrong.
  class InterviewQuestionGenerator
    PROMPT_VERSION = "v1".freeze
    QUESTION_COUNT = 20
    AREAS = %w[experience technical role_fit behavioural closing].freeze

    # Resume text is the bulk of the prompt and the part with no ceiling on its
    # length; the rest is bounded by what we extracted.
    MAX_RESUME_CHARS = 12_000

    class Error < Ai::Error; end

    def self.call(...) = new(...).call

    def initialize(candidate:, job: nil, provider: nil)
      @candidate = candidate
      @job = job
      @provider = provider || Ai::Provider.for
    end

    def call
      result = @provider.json_complete(
        prompt: user_prompt,
        system: "You are an experienced technical interviewer. Output valid JSON only.",
        max_tokens: 4096
      )

      questions = normalise(result["questions"])
      raise Error, "The AI returned no usable questions. Try again." if questions.empty?

      Ai::AuditLogger.record(
        operation: "interview_questions", status: "success", candidate: @candidate,
        job: @job,
        metadata: provider_metadata.merge(
          prompt_version: PROMPT_VERSION, question_count: questions.size
        )
      )

      questions
    rescue Ai::Error, StandardError => e
      Ai::AuditLogger.record(
        operation: "interview_questions", status: "failed",
        candidate: @candidate, job: @job, error: e
      )
      raise e.is_a?(Ai::Error) ? e : Error.new("Couldn't generate questions (#{e.class}). Try again.")
    end

    private
      def provider_metadata
        @provider.respond_to?(:last_metadata) ? @provider.last_metadata.to_h : {}
      end

      def user_prompt
        <<~PROMPT
          #{File.read(Rails.root.join("app/services/ai/prompts/interview_questions/#{PROMPT_VERSION}.txt"))}

          CANDIDATE PROFILE:
          """
          #{candidate_summary}
          """

          JOB BEING INTERVIEWED FOR:
          """
          #{job_summary}
          """

          RESUME TEXT:
          """
          #{resume_text}
          """
        PROMPT
      end

      def candidate_summary
        <<~TXT
          Name: #{@candidate.full_name.presence || 'Not given'}
          Current role: #{@candidate.current_role.presence || 'Not given'}
          Experience: #{@candidate.experience_years} years
          Highest qualification: #{@candidate.highest_qualification.presence || 'Not given'}
          Skills: #{list(@candidate.candidate_skills.map(&:name))}
          Past roles: #{list(@candidate.candidate_experiences.map { |e| [ e.job_title, e.company_name ].compact_blank.join(' at ') })}
          Certifications: #{list(@candidate.candidate_certifications.map(&:name))}
        TXT
      end

      # Absence is stated rather than left blank, so the model is told there is
      # no job instead of being handed an empty section it might invent one to
      # fill.
      def job_summary
        return "No specific job — ask about scope and responsibility generally." if @job.nil?

        <<~TXT
          Title: #{@job.title}
          Department: #{@job.try(:department)&.name || 'Not given'}
          Experience wanted: #{@job.try(:min_experience_years) || 'Not given'}
          Required skills: #{list(Array(@job.try(:required_skills)))}
          Description: #{@job.try(:description).to_s.truncate(2000).presence || 'Not given'}
        TXT
      end

      def resume_text
        text = @candidate.candidate_resumes.order(created_at: :desc).filter_map { |r| r.try(:raw_text) }.first
        text.presence&.truncate(MAX_RESUME_CHARS) || "Resume text is not available; use the profile above."
      end

      def list(values)
        Array(values).compact_blank.uniq.join(", ").presence || "None recorded"
      end

      # The model is asked for exactly 20 in five named areas. It is not
      # trusted to comply: an unknown area is filed under "experience" rather
      # than rendering as an empty group, blank questions are dropped, and the
      # list is capped so an over-eager response can't flood the panel.
      def normalise(raw)
        Array(raw).filter_map do |item|
          next unless item.is_a?(Hash)

          question = item["question"].to_s.strip
          next if question.blank?

          area = item["area"].to_s.strip.downcase
          {
            "area" => AREAS.include?(area) ? area : "experience",
            "question" => question,
            "why_it_matters" => item["why_it_matters"].to_s.strip.presence
          }
        end.first(QUESTION_COUNT)
      end
  end
end
