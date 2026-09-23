module Api
  module V1
    # The read side of the audit trail. The table has been written to since the
    # foundation phase and the `audit_logs.view` permission has been granted to
    # HR/Admin all along, but nothing ever served it — the trail was only
    # reachable from a database console, which makes it useless for the reviews
    # it exists to support.
    #
    # Read-only, and deliberately not paired with a destroy: retention is an
    # operations decision, not something an API hands out.
    class AuditLogsController < Api::V1::BaseController
      def index
        authorize AuditLog
        scope = policy_scope(AuditLog).includes(:actor)

        # `actionName`, not `action`: Rails already puts the controller action
        # in params[:action], so filtering on that key would always match the
        # string "index" instead of the caller's filter.
        scope = scope.where(action: params[:actionName]) if params[:actionName].present?
        scope = scope.where(actor_id: params[:actorId]) if params[:actorId].present?
        scope = scope.where(auditable_type: params[:auditableType]) if params[:auditableType].present?
        scope = scope.where(auditable_id: params[:auditableId]) if params[:auditableId].present?
        scope = scope.where(created_at: params[:from]..) if params[:from].present?
        scope = scope.where(created_at: ..params[:to]) if params[:to].present?

        scope = scope.order(created_at: :desc, id: :desc)

        page = [ params[:page].to_i, 1 ].max
        per_page = (params[:perPage].presence || 50).to_i.clamp(1, 200)
        total_count = scope.count
        records = scope.limit(per_page).offset((page - 1) * per_page)

        render json: {
          data: Api::V1::AuditLogSerializer.new(records).as_json,
          meta: {
            page: page, perPage: per_page,
            totalPages: (total_count / per_page.to_f).ceil, totalCount: total_count
          }
        }
      end

      def show
        audit_log = policy_scope(AuditLog).includes(:actor).find(params[:id])
        authorize audit_log
        render_data(Api::V1::AuditLogSerializer.new(audit_log).as_json)
      end

      # The distinct actions actually present, so a filter UI can offer the
      # values that exist rather than a hardcoded list that drifts every time
      # a new Audit::Record call site is added.
      def actions
        authorize AuditLog, :index?
        render_data(policy_scope(AuditLog).distinct.order(:action).pluck(:action))
      end
    end
  end
end
