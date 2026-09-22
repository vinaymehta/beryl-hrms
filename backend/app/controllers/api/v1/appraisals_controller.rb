module Api
  module V1
    # The workflow surface. Every action authorizes the specific move against
    # AppraisalPolicy, which knows both the viewer's relationship to the
    # appraisal AND the stage it is currently sitting at — so a final manager
    # can't file a calibration while the primary review is still outstanding.
    class AppraisalsController < Api::V1::BaseController
      rescue_from ::Appraisals::Workflow::Error, with: :render_unprocessable
      rescue_from ::Appraisals::SubmitRevision::Error, with: :render_unprocessable
      rescue_from ::Appraisals::Release::Error, with: :render_unprocessable
      rescue_from ::Appraisals::OverrideScore::Error, with: :render_unprocessable
      rescue_from ::Appraisals::SelfAppraisalImport::Error, with: :render_unprocessable

      def index
        authorize Appraisal
        scope = policy_scope(Appraisal).includes(
          :appraisal_cycle, :employee, :primary_manager, :final_manager, :revisions
        )
        scope = scope.where(appraisal_cycle_id: params[:cycleId]) if params[:cycleId].present?
        scope = scope.where(status: params[:status]) if params[:status].present?
        scope = scope.where(employee_id: params[:employeeId]) if params[:employeeId].present?

        # ?scope=mine  — the employee's own appraisals ("My Appraisal").
        # ?scope=pending — what is waiting on THIS user as a reviewer, right now.
        case params[:scope]
        when "mine" then scope = scope.where(employee_id: own_employee_id)
        when "pending" then scope = pending_for_reviewer(scope)
        end

        render_data(Api::V1::AppraisalSummarySerializer.new(scope.order(created_at: :desc)).as_json)
      end

      def show
        appraisal = find_appraisal
        authorize appraisal
        render_data(::Appraisals::DetailPresenter.call(appraisal: appraisal, user: Current.user))
      end

      # The employee's own V1.
      #
      # This always CREATES the revision. Passing submit=false used to create one
      # too and merely skip the workflow move, which meant a draft was a numbered
      # immutable version — untenable now the form saves at every step, and
      # already wrong: the manager's read-only reference is the first
      # self_appraisal revision, so a stale draft was what they reviewed against.
      # Work in progress goes to #save_draft instead.
      def submit_self
        appraisal = find_appraisal
        authorize appraisal, :submit_self?

        ActiveRecord::Base.transaction do
          ::Appraisals::SubmitRevision.call(
            appraisal: appraisal, stage: :self_appraisal, author_user: Current.user,
            answers: answer_params, narrative: narrative_params
          )
          # The draft has served its purpose; leaving it would reopen the
          # half-finished text next time the employee looks at the appraisal.
          appraisal.update!(self_appraisal_draft: {}, self_appraisal_draft_saved_at: nil)

          ::Appraisals::Workflow.new(appraisal: appraisal, to: :employee_submitted, actor: Current.user).call
          ::Appraisals::Workflow.new(appraisal: appraisal, to: :primary_review, actor: Current.user).call
        end

        ::Audit::Record.call(action: "appraisal.self_submitted", auditable: appraisal, request: request)
        render_detail(appraisal)
      end

      # Work in progress: mutable, unversioned, overwritten on every save, and
      # visible to nobody but its author (DetailPresenter sends it to the
      # subject alone). Nothing here has been submitted, so the workflow does
      # not move and no reviewer ever sees it.
      def save_draft
        appraisal = find_appraisal
        authorize appraisal, :save_self_draft?

        appraisal.update!(
          self_appraisal_draft: {
            "answers" => answer_params.map { |answer| answer.transform_keys(&:to_s) },
            "narrative" => narrative_params.transform_keys(&:to_s),
            "step" => params[:step].presence&.to_i
          },
          self_appraisal_draft_saved_at: Time.current
        )

        render_detail(appraisal)
      end

      # A reviewer's own independent version, at the stage they own.
      def submit_review
        appraisal = find_appraisal
        authorize appraisal, :submit_review?

        ActiveRecord::Base.transaction do
          ::Appraisals::SubmitRevision.call(
            appraisal: appraisal, stage: appraisal.status, author_user: Current.user,
            answers: answer_params, narrative: narrative_params
          )
          ::Appraisals::Workflow.new(
            appraisal: appraisal, to: next_status_after_review(appraisal), actor: Current.user, notes: params[:notes]
          ).call
        end

        ::Audit::Record.call(action: "appraisal.review_submitted", auditable: appraisal, request: request)
        render_detail(appraisal)
      end

      # Any explicit workflow move the UI offers (discussion, compensation step,
      # close). Kept manual on purpose — the workflow routes and notifies, it
      # never decides a review.
      def advance
        appraisal = find_appraisal
        authorize appraisal, :advance?
        ::Appraisals::Workflow.new(
          appraisal: appraisal, to: params[:to], actor: Current.user, notes: params[:notes]
        ).call
        ::Audit::Record.call(action: "appraisal.advanced", auditable: appraisal, request: request)
        render_detail(appraisal)
      end

      # Reopens the self-appraisal. Destroys nothing: the next submission simply
      # becomes the next version number.
      def return_for_correction
        appraisal = find_appraisal
        authorize appraisal, :return_for_correction?
        ::Appraisals::Workflow.new(
          appraisal: appraisal, to: :self_appraisal_open, actor: Current.user,
          notes: params[:notes].presence || "Returned for correction"
        ).call
        ::Audit::Record.call(action: "appraisal.returned", auditable: appraisal, request: request)
        render_detail(appraisal)
      end

      def override_score
        appraisal = find_appraisal
        authorize appraisal, :override_score?
        ::Appraisals::OverrideScore.call(
          appraisal: appraisal, score: params[:score], reason: params[:reason], actor: Current.user
        )
        ::Audit::Record.call(action: "appraisal.score_overridden", auditable: appraisal, request: request)
        render_detail(appraisal)
      end

      def release
        appraisal = find_appraisal
        authorize appraisal, :release?
        ::Appraisals::Release.call(appraisal: appraisal, actor: Current.user, notes: params[:notes])
        ::Audit::Record.call(action: "appraisal.released", auditable: appraisal, request: request)
        render_detail(appraisal)
      end

      def acknowledge
        appraisal = find_appraisal
        authorize appraisal, :acknowledge?
        ActiveRecord::Base.transaction do
          appraisal.update!(acknowledged_at: Time.current, acknowledgement_note: params[:note])
          ::Appraisals::Workflow.new(
            appraisal: appraisal, to: :employee_acknowledged, actor: Current.user, notes: params[:note]
          ).call
        end
        ::Audit::Record.call(action: "appraisal.acknowledged", auditable: appraisal, request: request)
        render_detail(appraisal)
      end

      # §17/§18. Increment and promotion are independent, and what was
      # RECOMMENDED is stored apart from what was APPROVED.
      #
      # The before/after diff on the audit entry is the approval history the
      # scope asks for (§17, §27) — recorded through the existing audit log
      # rather than a second history table alongside it.
      def compensation
        appraisal = find_appraisal
        authorize appraisal, :manage_compensation?
        decision = appraisal.compensation_decision || appraisal.build_compensation_decision
        tracked = compensation_params.keys.map(&:to_s)
        before = decision.persisted? ? decision.attributes.slice(*tracked) : {}

        decision.assign_attributes(compensation_params.merge(actor_user: Current.user))
        decision.save!

        ::Audit::Record.call(
          action: "appraisal.compensation_recorded", auditable: appraisal, request: request,
          before_changes: before, after_changes: decision.attributes.slice(*tracked)
        )
        render_detail(appraisal)
      end

      # The workbook an employee fills in offline (scope §10.1). Generated from
      # the cycle's frozen template and stamped with the metadata #import_preview
      # checks, so a workbook can't be filed against the wrong appraisal.
      def export
        appraisal = find_appraisal
        authorize appraisal, :show?
        exporter = ::Appraisals::WorkbookExporter.new(appraisal: appraisal)
        ::Audit::Record.call(action: "appraisal.workbook_exported", auditable: appraisal, request: request)
        send_data exporter.call,
                  filename: exporter.filename,
                  type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  disposition: "attachment"
      end

      # Upload → Validate → Parse → PREVIEW. Persists nothing: the parsed rows
      # go back to the employee, who confirms them in the form and submits
      # through #submit_self like any other self-appraisal. The spreadsheet is
      # an input convenience; the database remains the system of record.
      def import_preview
        appraisal = find_appraisal
        authorize appraisal, :submit_self?
        preview = ::Appraisals::SelfAppraisalImport.call(appraisal: appraisal, file: params[:file])
        ::Audit::Record.call(action: "appraisal.workbook_imported", auditable: appraisal, request: request)
        # Camelised here rather than by Alba: this is a plain Hash from a
        # service, not a serialized record, so it never passes through
        # ApplicationSerializer's `transform_keys :lower_camel`.
        render_data(preview.deep_transform_keys { |key| key.to_s.camelize(:lower) })
      end

      def add_comment
        appraisal = find_appraisal
        authorize appraisal, :show?

        comment_policy = AppraisalCommentPolicy.new(Current.user, appraisal)
        unless comment_policy.create?
          return render json: { errors: [ { code: "forbidden", message: "You can't comment on this appraisal." } ] },
                        status: :forbidden
        end

        # An employee can't mark their own comment management-only; by
        # definition it is one they can see.
        visibility = params[:visibility].presence || "management_only"
        visibility = "employee_visible" unless comment_policy.may_set_management_only?

        appraisal.comments.create!(
          author_user: Current.user, body: params[:body],
          visibility: visibility, appraisal_revision_id: params[:revision_id]
        )
        render_detail(appraisal, status: :created)
      end

      private
        def find_appraisal
          policy_scope(Appraisal).includes(
            :appraisal_cycle, :employee, :primary_manager, :secondary_manager, :final_manager,
            :transitions, :score_overrides, :compensation_decision, revisions: :answers
          ).find(params[:id])
        end

        def render_detail(appraisal, status: :ok)
          render_data(::Appraisals::DetailPresenter.call(appraisal: appraisal.reload, user: Current.user), status: status)
        end

        def own_employee_id = Current.user.employee_record&.id

        # "Waiting on me" means the appraisal is at the stage I own — not merely
        # that I appear somewhere in its reviewer chain.
        def pending_for_reviewer(scope)
          me = own_employee_id
          return scope.none if me.nil?

          scope.where(primary_manager_id: me, status: Appraisal.statuses[:primary_review])
               .or(scope.where(secondary_manager_id: me, status: Appraisal.statuses[:secondary_review]))
               .or(scope.where(final_manager_id: me, status: [
                 Appraisal.statuses[:final_review],
                 Appraisal.statuses[:appraisal_discussion],
                 Appraisal.statuses[:compensation_approval]
               ]))
        end

        def next_status_after_review(appraisal)
          case appraisal.status
          when "primary_review" then appraisal.next_review_status
          when "secondary_review" then :final_review
          when "final_review" then :appraisal_discussion
          else raise ::Appraisals::Workflow::Error, "There is no review to submit at this stage"
          end
        end

        def answer_params
          Array(params[:answers]).map do |answer|
            answer.permit(:question_id, :rating, :comment).to_h.symbolize_keys
          end
        end

        def narrative_params
          params.permit(:summary, :achievements, :strengths, :improvement_areas,
                        :training_needs, :next_period_goals).to_h.symbolize_keys
        end

        def compensation_params
          params.permit(
            :current_compensation, :last_increment_percentage, :last_increment_on,
            :recommended_increment_percentage, :recommended_compensation,
            :approved_increment_percentage, :approved_compensation,
            :effective_date, :management_comments,
            :promotion_recommendation, :proposed_designation_id,
            :promotion_reason, :promotion_effective_date, :new_responsibilities
          )
        end
    end
  end
end
