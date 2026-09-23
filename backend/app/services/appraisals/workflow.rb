module Appraisals
  # The state machine. Every move goes through here, and every move records an
  # AppraisalTransition with actor, from, to, timestamp and optional note — the
  # scope's audit requirement is met by construction rather than by remembering
  # to log at each call site.
  #
  # Transitions are deliberately MANUAL. The workflow moves the appraisal along
  # and tells the next person, but no step decides a review on anyone's behalf.
  class Workflow
    class Error < StandardError; end

    # from => permitted next states. The branch after a primary review is
    # resolved at runtime by Appraisal#next_review_status, so both are allowed
    # here and the caller doesn't choose.
    ALLOWED = {
      "draft" => %w[self_appraisal_open],
      "self_appraisal_open" => %w[employee_submitted],
      "employee_submitted" => %w[primary_review self_appraisal_open],
      "primary_review" => %w[secondary_review final_review self_appraisal_open],
      "secondary_review" => %w[final_review primary_review self_appraisal_open],
      "final_review" => %w[appraisal_discussion secondary_review primary_review self_appraisal_open],
      "appraisal_discussion" => %w[compensation_approval released final_review],
      "compensation_approval" => %w[released appraisal_discussion],
      "released" => %w[employee_acknowledged closed],
      "employee_acknowledged" => %w[closed],
      "closed" => []
    }.freeze

    def self.call(...) = new(...).call

    def initialize(appraisal:, to:, actor: Current.user, notes: nil)
      @appraisal = appraisal
      @to = to.to_s
      @actor = actor
      @notes = notes
    end

    def call
      from = @appraisal.status
      unless ALLOWED.fetch(from, []).include?(@to)
        raise Error, "An appraisal can't move from #{from.humanize.downcase} to #{@to.humanize.downcase}"
      end

      ActiveRecord::Base.transaction do
        @appraisal.update!(status: @to)
        self.class.record_transition(@appraisal, from: from, to: @to, actor: @actor, notes: @notes)
      end

      announce(from)
      @appraisal
    end

    # Also used by StartCycle, which creates an appraisal already in
    # self_appraisal_open and so has no prior status to move from.
    def self.record_transition(appraisal, from:, to:, actor:, notes: nil)
      appraisal.transitions.create!(
        actor_user: actor,
        from_status: from && Appraisal.statuses[from.to_s],
        to_status: Appraisal.statuses[to.to_s],
        notes: notes
      )
    end

    private
      # Tell whoever the ball is now with. Failing to notify must never roll back
      # a transition that has already legitimately happened, so this runs after
      # the transaction commits.
      def announce(from)
        case @to
        when "primary_review" then Notifier.review_pending(@appraisal, role: :primary)
        when "secondary_review" then Notifier.review_pending(@appraisal, role: :secondary)
        when "final_review" then Notifier.review_pending(@appraisal, role: :final)
        # Past the reviewer chain. Nobody is named on the appraisal for these
        # two steps, so they are announced to whoever holds the permission —
        # otherwise the appraisal finishes its reviews and then waits in silence.
        when "appraisal_discussion" then Notifier.ready_for_release(@appraisal, except_user: @actor)
        when "compensation_approval" then Notifier.compensation_approval_pending(@appraisal, except_user: @actor)
        when "released"
          Notifier.released(@appraisal)
          Notifier.acknowledgement_required(@appraisal)
        when "employee_acknowledged" then Notifier.acknowledged(@appraisal)
        when "self_appraisal_open"
          Notifier.returned_for_correction(@appraisal, @notes) unless from == "draft"
        end
      rescue StandardError => e
        # A notification is a courtesy; the transition is the fact.
        Rails.logger.warn("[appraisal] notification failed for ##{@appraisal.id}: #{e.class}: #{e.message}")
      end
  end
end
