module Appraisals
  # Creates one immutable revision — V1 for the employee's self-appraisal, V2 for
  # the primary manager, V3 for the secondary, and the final reviewer's version
  # after that. The version number comes from the existing history, so a
  # returned-and-resubmitted appraisal simply adds another.
  #
  # Nothing is ever overwritten. A correction is a NEW revision sitting on top of
  # the old ones, and every earlier revision stays readable to whoever is
  # authorized to see it.
  class SubmitRevision
    class Error < StandardError; end

    # How a perspective's per-employee manager assessment is keyed inside a
    # revision's `responses`, alongside the template's own field keys.
    MANAGER_RATING_SUFFIX = "__manager_rating".freeze
    MANAGER_SUMMARY_SUFFIX = "__manager_summary".freeze

    STAGE_FOR_STATUS = {
      "self_appraisal_open" => :self_appraisal,
      "primary_review" => :primary_review,
      "secondary_review" => :secondary_review,
      "final_review" => :final_review
    }.freeze

    def self.call(...) = new(...).call

    # @param answers [Array<Hash>] {question_id:, rating:, comment:}
    # @param narrative [Hash] summary/achievements/strengths/... free-text blocks
    # @param responses [Hash] answers to the TEMPLATE's own free-text fields,
    #   keyed by the workbook field key. Separate from `narrative` because
    #   those six are fixed columns and these are whatever the imported
    #   spreadsheet defined — see the `responses` migration.
    def initialize(appraisal:, stage:, author_user:, answers: [], narrative: {}, responses: {})
      @appraisal = appraisal
      @stage = stage.to_s
      @author_user = author_user
      @answers = Array(answers)
      @narrative = narrative || {}
      @responses = responses || {}
    end

    def call
      validate_stage!

      revision = nil
      ActiveRecord::Base.transaction do
        revision = @appraisal.revisions.create!(
          stage: @stage,
          author_user: @author_user,
          author_employee: @author_user&.employee_record,
          responses: template_responses,
          **narrative_attributes
        )

        build_answers(revision)

        # One post-insert write, through the model's deliberately awkward escape
        # hatch, to attach the score computed from the answers just written.
        score = Scorer.call(revision).score
        revision.with_initial_write { |r| r.update_columns(calculated_score: score) } if score

        # The appraisal's own calculated score tracks the LATEST management
        # view of it; the employee's own V1 score never becomes the official one.
        @appraisal.update!(calculated_score: score) if score && @stage != "self_appraisal"
      end

      revision.reload
    end

    private
      def validate_stage!
        expected = STAGE_FOR_STATUS[@appraisal.status]
        return if expected.to_s == @stage

        raise Error, "A #{@stage.humanize.downcase} can't be submitted while the appraisal is #{@appraisal.status.humanize.downcase}"
      end

      # Only keys the CYCLE'S FROZEN template actually defines are stored, for
      # the same reason #build_answers checks question ids: a field that isn't
      # on this appraisal's form has no business being answered on it.
      def template_responses
        keys = template_field_keys
        return {} if keys.empty?

        @responses.to_h { |key, value| [ key.to_s, value ] }.slice(*keys)
      end

      def template_field_keys
        structure = @appraisal.appraisal_cycle.appraisal_template.structure || {}
        sections = Array(structure["wizardSections"] || structure["wizard_sections"])

        sections.flat_map do |section|
          keys = Array(section["fields"]).map { |field| field["key"].to_s }.compact_blank
          next keys unless section["kind"] == "perspectives"

          # A perspective's weight and focus belong to the TEMPLATE; the rating
          # and the evidence behind it are this reviewer's assessment of this
          # employee, so they are answered per appraisal rather than stored on
          # the template. Derived from the template's own keys so the allowlist
          # still comes from the form, not from whatever a client posts.
          keys + keys.flat_map { |key| [ "#{key}#{MANAGER_RATING_SUFFIX}", "#{key}#{MANAGER_SUMMARY_SUFFIX}" ] }
        end
      end

      def narrative_attributes
        @narrative.slice(
          :summary, :achievements, :strengths, :improvement_areas, :training_needs, :next_period_goals
        ).symbolize_keys
      end

      def build_answers(revision)
        question_ids = valid_question_ids

        @answers.each do |answer|
          question_id = answer[:question_id] || answer["question_id"]
          next if question_id.blank?

          unless question_ids.include?(question_id.to_i)
            raise Error, "Question #{question_id} does not belong to this appraisal's template"
          end

          revision.answers.create!(
            appraisal_template_question_id: question_id,
            rating: answer[:rating] || answer["rating"],
            comment: answer[:comment] || answer["comment"]
          )
        end
      end

      # Read through the cycle's FROZEN template — a question added to a newer
      # template version has no business appearing in this appraisal.
      def valid_question_ids
        @valid_question_ids ||= AppraisalTemplateQuestion
          .joins(:appraisal_template_category)
          .where(appraisal_template_categories: { appraisal_template_id: @appraisal.appraisal_cycle.appraisal_template_id })
          .pluck(:id)
          .to_set
      end
  end
end
