module Appraisals
  # Turns a draft cycle into a running one: one Appraisal per eligible employee,
  # each with its reviewers SNAPSHOTTED from the existing employee_managers
  # hierarchy.
  #
  # Snapshotted, not looked up live, on purpose. A reorg mid-cycle must not
  # silently redirect an appraisal someone has already half-reviewed, nor strand
  # one whose manager changed. The hierarchy stays the single source of truth
  # for who reports to whom; this records who was responsible for THIS cycle.
  #
  # Nothing here invents a second manager system — it reads
  # Employee#primary_manager / #secondary_manager / #final_manager.
  class StartCycle
    class Error < StandardError; end

    Result = Struct.new(:created_count, :skipped, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(cycle:, actor: Current.user)
      @cycle = cycle
      @actor = actor
    end

    def call
      raise Error, "This cycle has already been started" if @cycle.started?
      raise Error, "A cycle needs at least one eligible employee before it can start" if participants.empty?

      created = 0
      skipped = []

      ActiveRecord::Base.transaction do
        participants.each do |employee|
          if employee.primary_manager_id.blank?
            # Refused rather than guessed: an appraisal with nobody to review it
            # would sit in the workflow forever.
            skipped << { employee_id: employee.id, name: employee.full_name, reason: "no primary manager assigned" }
            next
          end

          appraisal = build_appraisal(employee)
          appraisal.save!
          Workflow.record_transition(appraisal, from: nil, to: :self_appraisal_open, actor: @actor,
                                     notes: "Cycle started")
          Notifier.self_appraisal_opened(appraisal)
          created += 1
        end

        @cycle.update!(status: :active, started_at: Time.current)
      end

      Result.new(created_count: created, skipped: skipped)
    end

    private
      def participants
        @participants ||= @cycle.eligible_employees.includes(:manager_assignments).to_a
      end

      def build_appraisal(employee)
        @cycle.appraisals.new(
          company_id: @cycle.company_id,
          employee: employee,
          status: :self_appraisal_open,
          primary_manager_id: employee.primary_manager_id,
          # Only carried when the cycle actually runs a secondary step, so the
          # appraisal's own record says whether one is expected.
          secondary_manager_id: @cycle.secondary_review_enabled? ? employee.secondary_manager_id : nil,
          final_manager_id: employee.final_manager_id
        )
      end
  end
end
