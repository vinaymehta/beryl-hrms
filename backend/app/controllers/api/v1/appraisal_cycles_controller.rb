module Api
  module V1
    class AppraisalCyclesController < Api::V1::BaseController
      rescue_from ::Appraisals::StartCycle::Error, with: :render_unprocessable

      def index
        authorize AppraisalCycle
        cycles = policy_scope(AppraisalCycle)
                   .includes(:appraisal_template, :participants, :appraisals)
                   .newest_first
        cycles = cycles.where(status: params[:status]) if params[:status].present?
        render_data(Api::V1::AppraisalCycleSerializer.new(cycles).as_json)
      end

      def show
        cycle = find_cycle
        authorize cycle
        render_data(
          Api::V1::AppraisalCycleSerializer.new(cycle).as_json.merge(
            "eligibleEmployees" => Api::V1::EmployeeSummarySerializer.new(cycle.eligible_employees.to_a).as_json
          )
        )
      end

      def create
        authorize AppraisalCycle
        cycle = nil
        ActiveRecord::Base.transaction do
          cycle = current_company.appraisal_cycles.new(cycle_params.merge(created_by: Current.user))
          cycle.save!
          sync_participants(cycle)
        end
        ::Audit::Record.call(action: "appraisal_cycle.created", auditable: cycle, request: request)
        render_data(Api::V1::AppraisalCycleSerializer.new(cycle.reload).as_json, status: :created)
      end

      def update
        cycle = find_cycle
        authorize cycle
        ActiveRecord::Base.transaction do
          cycle.update!(cycle_params)
          sync_participants(cycle)
        end
        ::Audit::Record.call(action: "appraisal_cycle.updated", auditable: cycle, request: request)
        render_data(
          Api::V1::AppraisalCycleSerializer.new(cycle.reload).as_json.merge(
            "addedCount" => @participant_result&.added&.size.to_i,
            # Camelised by hand: these are plain Hashes from a service, so they
            # never pass through the serializer's own key transform.
            "skipped" => (@participant_result&.skipped || []).map { |entry|
              entry.transform_keys { |key| key.to_s.camelize(:lower) }
            }
          )
        )
      end

      # Instantiates one appraisal per eligible employee and opens their
      # self-appraisals. Anyone without a primary manager is reported back in
      # `skipped` rather than silently dropped — see Appraisals::StartCycle.
      def start
        cycle = find_cycle
        authorize cycle, :start?
        result = ::Appraisals::StartCycle.call(cycle: cycle, actor: Current.user)
        ::Audit::Record.call(action: "appraisal_cycle.started", auditable: cycle, request: request)

        render_data(
          Api::V1::AppraisalCycleSerializer.new(cycle.reload).as_json.merge(
            "createdCount" => result.created_count,
            "skipped" => result.skipped.map { |entry|
              entry.transform_keys { |key| key.to_s.camelize(:lower) }
            }
          )
        )
      end

      # §16 Calibration dashboard: one organisation-level row per employee with
      # self rating, manager rating, weighted score and final rating, so a Final
      # Reviewer can see inconsistency across the cohort rather than one
      # appraisal at a time.
      #
      # Gated on appraisals.view_all — calibration is inherently a view across
      # other people's appraisals, so the reviewer-scoped AppraisalPolicy::Scope
      # would be the wrong lens here.
      def calibration
        cycle = find_cycle
        authorize cycle, :show?
        unless policy(Appraisal).administrator?
          return render json: { errors: [ { code: "forbidden", message: "Calibration needs company-wide appraisal access." } ] },
                        status: :forbidden
        end

        calibration = ::Appraisals::Calibration.call(cycle: cycle)
        render_data(calibration.deep_transform_keys { |key| key.to_s.camelize(:lower) })
      end

      def close
        cycle = find_cycle
        authorize cycle, :close?
        cycle.update!(status: :closed, closed_at: Time.current)
        ::Audit::Record.call(action: "appraisal_cycle.closed", auditable: cycle, request: request)
        render_data(Api::V1::AppraisalCycleSerializer.new(cycle.reload).as_json)
      end

      # A started cycle can be deleted too.
      #
      # It used to be refused, on the reasoning that appraisals in flight are
      # history worth keeping. In practice cycles get created wrong — wrong
      # template, wrong cohort, wrong dates — and "close it instead" leaves a
      # mistake permanently in everybody's list. The appraisals go with it
      # (`dependent: :destroy`), which is the honest meaning of deleting the
      # cycle they belong to.
      #
      # What must NOT survive is anything that would go on firing afterwards:
      # notifications pointing at a cycle that no longer exists, and reminder
      # jobs that would raise or, worse, quietly mail somebody about it.
      def destroy
        cycle = find_cycle
        authorize cycle

        summary = { appraisals: cycle.appraisals.count, participants: cycle.participants.count }
        ::Appraisals::CancelCycleNotifications.call(cycle: cycle)
        cycle.destroy!

        ::Audit::Record.call(
          action: "appraisal_cycle.deleted", auditable: cycle, request: request,
          before_changes: summary
        )
        head :no_content
      end

      private
        def find_cycle
          policy_scope(AppraisalCycle).includes(:appraisal_template, :participants, :appraisals).find(params[:id])
        end

        def cycle_params
          params.permit(
            :name, :description, :appraisal_template_id, :status, :review_type,
            :assessment_period_start, :assessment_period_end, :starts_on,
            :employee_submission_deadline, :primary_review_deadline,
            :secondary_review_deadline, :finalization_deadline,
            :compensation_effective_date, :secondary_review_enabled
          )
        end

        # Eligibility comes from real employee records, and can now be edited
        # after a cycle has started as well as before.
        #
        # Adding goes through Appraisals::AddParticipants, which creates the
        # appraisal and notifies the person when the cycle is already running —
        # the same treatment everyone else got when it started. Removing is
        # only ever a removal from the eligibility list; an appraisal that
        # already exists is left alone, because deleting somebody's half-written
        # self-appraisal is not what "take them off the list" means.
        def sync_participants(cycle)
          return unless params.key?(:eligible_employee_ids)

          desired = Array(params.permit(eligible_employee_ids: [])[:eligible_employee_ids]).compact_blank.map(&:to_i).uniq
          # Scoped through the tenant's own employees, so a foreign id simply
          # isn't found rather than being trusted.
          desired &= current_company.employees.where(id: desired).pluck(:id)

          current = cycle.participants.pluck(:employee_id)
          cycle.participants.where(employee_id: current - desired).destroy_all

          @participant_result = ::Appraisals::AddParticipants.call(
            cycle: cycle, employee_ids: desired - current, actor: Current.user
          )
          cycle.participants.reset
        end
    end
  end
end
