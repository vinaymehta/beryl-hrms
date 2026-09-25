module Appraisals
  # Adds employees to a cycle that is already running.
  #
  # Before this, eligibility was frozen the moment a cycle started — which is
  # right for who has ALREADY been appraised, and wrong for a new joiner or
  # somebody HR simply missed. Adding one now does the same thing starting the
  # cycle did for everybody else: creates their appraisal with its reviewers
  # snapshotted, opens their self-appraisal, and tells them.
  #
  # Two things it is careful about, both about not annoying people:
  #
  #   • Somebody already in the cycle is a no-op. Re-saving the eligibility list
  #     with one name added must not re-notify the other forty.
  #   • An employee with no appraisal yet (added to a cycle that has not
  #     started) is recorded as eligible and nothing more. Their notification
  #     comes when the cycle starts, from StartCycle, exactly as it always did.
  class AddParticipants
    Result = Struct.new(:added, :skipped, :appraisals, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(cycle:, employee_ids:, actor: Current.user)
      @cycle = cycle
      @employee_ids = Array(employee_ids).compact_blank.map(&:to_i).uniq
      @actor = actor
    end

    def call
      return Result.new(added: [], skipped: [], appraisals: []) if @employee_ids.empty?

      added = []
      skipped = []
      appraisals = []

      ActiveRecord::Base.transaction do
        employees.each do |employee|
          if already_in?(employee)
            # Not an error, and not worth telling anybody about — this is what
            # re-saving an unchanged list looks like.
            skipped << { employee_id: employee.id, name: employee.full_name, reason: "already in this cycle" }
            next
          end

          @cycle.participants.create!(employee_id: employee.id)
          added << employee

          next unless @cycle.started?

          if employee.primary_manager_id.blank?
            # Same rule StartCycle applies: an appraisal with nobody to review
            # it would sit in the workflow forever, so it is refused and
            # reported rather than created.
            skipped << { employee_id: employee.id, name: employee.full_name, reason: "no primary manager assigned" }
            next
          end

          appraisals << create_appraisal(employee)
        end

        @cycle.participants.reset
      end

      announce(appraisals)

      Result.new(added: added, skipped: skipped, appraisals: appraisals)
    end

    private
      def employees
        @employees ||= @cycle.company.employees
                             .where(id: @employee_ids)
                             .includes(:manager_assignments)
                             .to_a
      end

      # By appraisal as well as by participant row: a cycle can have had an
      # employee removed from its eligibility list while their appraisal
      # survives, and re-adding them must not mint a second one.
      def already_in?(employee)
        @cycle.participants.exists?(employee_id: employee.id) ||
          @cycle.appraisals.exists?(employee_id: employee.id)
      end

      def create_appraisal(employee)
        appraisal = @cycle.appraisals.create!(
          company_id: @cycle.company_id,
          employee: employee,
          status: :self_appraisal_open,
          primary_manager_id: employee.primary_manager_id,
          secondary_manager_id: @cycle.secondary_review_enabled? ? employee.secondary_manager_id : nil,
          final_manager_id: employee.final_manager_id
        )
        Workflow.record_transition(appraisal, from: nil, to: :self_appraisal_open, actor: @actor,
                                   notes: "Added to cycle after it started")
        appraisal
      end

      # After the commit, and never able to undo it — the same rule StartCycle
      # follows. The appraisals are the fact; telling people is the courtesy,
      # and a courtesy does not get to roll back the fact.
      def announce(appraisals)
        appraisals.each do |appraisal|
          Notifier.self_appraisal_opened(appraisal)
        rescue StandardError => e
          Rails.logger.warn(
            "[appraisal] add-participant notification failed for ##{appraisal.id}: #{e.class}: #{e.message}"
          )
        end
      end
  end
end
