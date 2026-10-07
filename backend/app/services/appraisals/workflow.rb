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

    # from => permitted next states. Which manager level comes next, or whether
    # the Final review does, is resolved by Appraisal#first_review_step and
    # #step_after_manager_review — the caller doesn't choose.
    #
    # manager_review → manager_review is one level handing to the next.
    # primary_review / secondary_review are the old fixed stages; nothing enters
    # them now, but they keep exits so no historical row is stranded.
    ALLOWED = {
      "draft" => %w[self_appraisal_open],
      "self_appraisal_open" => %w[employee_submitted],
      "employee_submitted" => %w[manager_review final_review self_appraisal_open],
      "manager_review" => %w[manager_review final_review self_appraisal_open],
      "primary_review" => %w[manager_review final_review self_appraisal_open],
      "secondary_review" => %w[manager_review final_review self_appraisal_open],
      "final_review" => %w[appraisal_discussion manager_review self_appraisal_open],
      # Compensation & Promotion is withdrawn from the workflow. The status
      # itself is NOT removed from Appraisal — historical appraisals sit in it
      # and their rows must keep resolving — but nothing can move INTO it any
      # more, so no new appraisal ever reaches it.
      #
      # `compensation_approval` keeps its own exits so an appraisal already
      # parked there when this shipped can still be finished rather than
      # stranded.
      "appraisal_discussion" => %w[released final_review],
      "compensation_approval" => %w[released appraisal_discussion],
      "released" => %w[employee_acknowledged closed],
      "employee_acknowledged" => %w[closed],
      "closed" => []
    }.freeze

    def self.call(...) = new(...).call

    # @param level [Integer, nil] the manager level, when moving to manager_review.
    # @param announce [Boolean] false for a step that is passed straight
    #   through in the same request (see AppraisalsController#submit_review),
    #   so nobody is told an appraisal is waiting at a stage it has already left.
    def initialize(appraisal:, to:, actor: Current.user, notes: nil, level: nil, announce: true)
      @appraisal = appraisal
      @to = to.to_s
      @actor = actor
      @notes = notes
      @level = level
      @announce = announce
    end

    def call
      from = @appraisal.status
      unless ALLOWED.fetch(from, []).include?(@to)
        raise Error, "An appraisal can't move from #{from.humanize.downcase} to #{@to.humanize.downcase}"
      end

      if @to == "manager_review" && @appraisal.reviewer_id_at(@level).nil?
        raise Error, "There is no manager at level #{@level} to review this appraisal"
      end

      ActiveRecord::Base.transaction do
        @appraisal.update!(status: @to, review_level: @to == "manager_review" ? @level : nil)
        notes = @notes.presence || ("Level #{@level} manager review" if @to == "manager_review")
        self.class.record_transition(@appraisal, from: from, to: @to, actor: @actor, notes: notes)
      end

      announce(from) if @announce
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
        when "manager_review" then Notifier.review_pending(@appraisal, level: @appraisal.review_level)
        # No one person is named for the Final review — it is Admin/HR's.
        when "final_review" then Notifier.final_review_pending(@appraisal, except_user: @actor)
        # Past the reviewer chain. Nobody is named on the appraisal for these
        # two steps, so they are announced to whoever holds the permission —
        # otherwise the appraisal finishes its reviews and then waits in silence.
        when "appraisal_discussion" then Notifier.ready_for_release(@appraisal, except_user: @actor)
        # The appraisal letter, to sign — see Appraisals::Release.
        when "released" then Notifier.letter_issued(@appraisal)
        # Signing the letter is how an appraisal is acknowledged now; the plain
        # acknowledgement stays for one that reached this step without a letter.
        when "employee_acknowledged"
          @appraisal.letter_signed? ? Notifier.letter_signed(@appraisal) : Notifier.acknowledged(@appraisal)
        when "self_appraisal_open"
          Notifier.returned_for_correction(@appraisal, @notes) unless from == "draft"
        end
      rescue StandardError => e
        # A notification is a courtesy; the transition is the fact.
        Rails.logger.warn("[appraisal] notification failed for ##{@appraisal.id}: #{e.class}: #{e.message}")
      end
  end
end
