module Appraisals
  # Final-reviewer calibration. The calculated score is never touched: the
  # override is a new row carrying both numbers and a mandatory reason, and
  # every override made stays on the record.
  class OverrideScore
    class Error < StandardError; end

    def self.call(...) = new(...).call

    def initialize(appraisal:, score:, reason:, actor: Current.user)
      @appraisal = appraisal
      @score = score
      @reason = reason
      @actor = actor
    end

    def call
      raise Error, "A reason is required to override the calculated score" if @reason.blank?

      ActiveRecord::Base.transaction do
        @appraisal.score_overrides.create!(
          actor_user: @actor,
          previous_score: @appraisal.effective_score,
          new_score: @score,
          reason: @reason
        )
        @appraisal.update!(final_score: @score)
      end

      @appraisal
    end
  end
end
