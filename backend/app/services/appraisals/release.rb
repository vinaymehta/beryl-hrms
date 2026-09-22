module Appraisals
  # HR/Admin releasing a finalized appraisal to the employee. This is the moment
  # the employee's view changes: before it they see only their own V1 and the
  # status; after it they additionally see the final version and every comment
  # marked employee_visible.
  class Release
    class Error < StandardError; end

    def self.call(...) = new(...).call

    def initialize(appraisal:, actor: Current.user, notes: nil)
      @appraisal = appraisal
      @actor = actor
      @notes = notes
    end

    def call
      unless %w[appraisal_discussion compensation_approval].include?(@appraisal.status)
        raise Error, "An appraisal can only be released after the discussion or compensation step"
      end
      raise Error, "This appraisal has no final review to release" if @appraisal.revision_for(:final_review).nil?

      ActiveRecord::Base.transaction do
        @appraisal.update!(released_at: Time.current, released_by: @actor)
        Workflow.new(appraisal: @appraisal, to: :released, actor: @actor, notes: @notes).call
      end

      @appraisal
    end
  end
end
