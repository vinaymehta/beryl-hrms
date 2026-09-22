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
        render_data(Api::V1::AppraisalCycleSerializer.new(cycle.reload).as_json)
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
            "skipped" => result.skipped
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

      def destroy
        cycle = find_cycle
        authorize cycle
        if cycle.started?
          return render json: { errors: [ { code: "unprocessable", message: "A started cycle can't be deleted — close it instead." } ] },
                        status: :unprocessable_content
        end

        cycle.destroy!
        ::Audit::Record.call(action: "appraisal_cycle.deleted", auditable: cycle, request: request)
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

        # Eligibility comes from real employee records, and is only editable
        # while the cycle hasn't started — afterwards the appraisals themselves
        # are the record of who is in it.
        def sync_participants(cycle)
          return unless params.key?(:eligible_employee_ids)

          if cycle.started?
            raise ActionController::BadRequest, "Eligibility can't change after a cycle has started"
          end

          desired = Array(params.permit(eligible_employee_ids: [])[:eligible_employee_ids]).compact_blank.map(&:to_i).uniq
          # Scoped through the tenant's own employees, so a foreign id simply
          # isn't found rather than being trusted.
          desired &= current_company.employees.where(id: desired).pluck(:id)

          current = cycle.participants.pluck(:employee_id)
          cycle.participants.where(employee_id: current - desired).destroy_all
          (desired - current).each { |employee_id| cycle.participants.create!(employee_id: employee_id) }
          cycle.participants.reset
        end
    end
  end
end
