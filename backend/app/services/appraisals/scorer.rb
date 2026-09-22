module Appraisals
  # The scope's formula, in one place:
  #
  #   Σ(Category Rating × Category Weight)
  #
  # where a Category Rating is the mean of the answered question ratings in that
  # category, and Weight is the category's percentage of the template. The result
  # therefore lands back on the same 1–5 scale the ratings use, which is what
  # makes it comparable with an override.
  #
  # Unanswered questions are excluded rather than counted as zero — a partly
  # filled draft should read as "incomplete", not as "scored badly".
  class Scorer
    Result = Struct.new(:score, :category_breakdown, :lens_breakdown, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(revision)
      @revision = revision
    end

    def call
      categories = template_categories
      return Result.new(score: nil, category_breakdown: [], lens_breakdown: {}) if categories.empty?

      breakdown = categories.filter_map { |category| score_category(category) }
      total = breakdown.sum { |row| row[:weighted] }

      Result.new(
        score: breakdown.empty? ? nil : total.round(2),
        category_breakdown: breakdown,
        lens_breakdown: lens_totals(breakdown)
      )
    end

    private
      def ratings_by_question
        @ratings_by_question ||= @revision.answers.where.not(rating: nil).pluck(:appraisal_template_question_id, :rating).to_h
      end

      # Read through the appraisal's CYCLE template, which is frozen — never
      # through whatever the newest template version happens to be now.
      def template_categories
        @revision.appraisal.appraisal_cycle.appraisal_template.categories.includes(:questions)
      end

      def score_category(category)
        ratings = category.questions.filter_map { |question| ratings_by_question[question.id] }
        return nil if ratings.empty?

        average = ratings.sum.to_d / ratings.size
        weight = category.weight.to_d

        {
          category_id: category.id,
          name: category.name,
          lens: category.lens,
          weight: weight.to_f,
          average_rating: average.round(2).to_f,
          answered: ratings.size,
          total_questions: category.questions.size,
          weighted: (average * weight / 100)
        }
      end

      def lens_totals(breakdown)
        breakdown.group_by { |row| row[:lens] }.transform_values do |rows|
          {
            weight: rows.sum { |row| row[:weight] }.round(2),
            weighted_score: rows.sum { |row| row[:weighted] }.round(2).to_f
          }
        end
      end
  end
end
