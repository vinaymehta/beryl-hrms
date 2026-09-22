module Appraisals
  # Builds the appraisal detail payload FOR ONE VIEWER.
  #
  # Every visibility rule in the feature converges here, deliberately, so the
  # answer to "can this person see this?" is decided once and is auditable in
  # one file rather than scattered across serializers and React components:
  #
  #   • revisions        — filtered by AppraisalPolicy#visible_revision_stages.
  #                        An employee gets their own V1 before release, and
  #                        their V1 plus the final version after it. A manager's
  #                        ratings never reach them early.
  #   • comments         — through AppraisalCommentPolicy::Scope, so a
  #                        management_only row is excluded by the QUERY.
  #   • compensation     — only for appraisals.manage_compensation.
  #   • template         — always the CYCLE's frozen template, never the newest.
  #
  # The `viewer` block tells the UI what it may offer, so the frontend never has
  # to re-derive a rule this class already decided.
  class DetailPresenter
    def self.call(...) = new(...).call

    def initialize(appraisal:, user:)
      @appraisal = appraisal
      @user = user
      @policy = AppraisalPolicy.new(user, appraisal)
    end

    def call
      Api::V1::AppraisalSummarySerializer.new(@appraisal).as_json.merge(
        "cycle" => Api::V1::AppraisalCycleSerializer.new(@appraisal.appraisal_cycle).as_json,
        "template" => Api::V1::AppraisalTemplateSerializer.new(frozen_template).as_json,
        "revisions" => Api::V1::AppraisalRevisionSerializer.new(visible_revisions).as_json,
        "comments" => Api::V1::AppraisalCommentSerializer.new(visible_comments).as_json,
        "transitions" => Api::V1::AppraisalTransitionSerializer.new(@appraisal.transitions.to_a).as_json,
        "scoreOverrides" => Api::V1::AppraisalScoreOverrideSerializer.new(@appraisal.score_overrides.to_a).as_json,
        "compensation" => compensation_payload,
        "designationOptions" => designation_options,
        "selfAppraisalDraft" => self_appraisal_draft,
        "managers" => managers_payload,
        "viewer" => viewer_payload
      )
    end

    private
      # The employee's own unsubmitted work, and nobody else's business — not
      # HR's and not a manager's. It is neither a revision nor a submission, so
      # the only person it is sent to is the one who typed it.
      def self_appraisal_draft
        return nil unless @policy.save_self_draft?

        draft = @appraisal.self_appraisal_draft
        return nil if draft.blank?

        draft.merge("savedAt" => @appraisal.self_appraisal_draft_saved_at)
      end

      def frozen_template
        @appraisal.appraisal_cycle.appraisal_template
      end

      def visible_revisions
        stages = @policy.visible_revision_stages
        return [] if stages.empty?

        @appraisal.revisions.where(stage: stages).includes(:answers, :author_employee, :author_user).to_a
      end

      def visible_comments
        AppraisalCommentPolicy::Scope
          .new(@user, @appraisal.comments)
          .resolve
          .includes(:author_user)
          .newest_first
          .to_a
      end

      def compensation_payload
        return nil unless @policy.view_compensation?
        return nil if @appraisal.compensation_decision.nil?

        Api::V1::AppraisalCompensationDecisionSerializer.new(@appraisal.compensation_decision).as_json
      end

      # The designations a promotion can propose. Only sent to someone who may
      # actually record one, so the picker never leaks to other viewers.
      def designation_options
        return [] unless @policy.manage_compensation?

        Designation.where(company_id: @appraisal.company_id, status: :active)
                   .order(:title)
                   .map { |designation| { "id" => designation.id, "title" => designation.title } }
      end

      # Names only — the reviewer chain is not sensitive, and the employee is
      # explicitly allowed to see who their managers are.
      def managers_payload
        {
          "primary" => manager_summary(@appraisal.primary_manager),
          "secondary" => manager_summary(@appraisal.secondary_manager),
          "final" => manager_summary(@appraisal.final_manager)
        }
      end

      def manager_summary(employee)
        return nil if employee.nil?

        Api::V1::EmployeeSummarySerializer.new(employee).as_json
      end

      # What this viewer is, and what they may do RIGHT NOW at this status.
      def viewer_payload
        {
          "level" => @policy.my_level,
          "isSubject" => @policy.subject?,
          "isAdministrator" => @policy.administrator?,
          "canSaveSelfDraft" => @policy.save_self_draft?,
          "canSubmitSelf" => @policy.submit_self?,
          "canSubmitReview" => @policy.submit_review?,
          "canReturnForCorrection" => @policy.return_for_correction?,
          "canAdvance" => @policy.advance?,
          "canOverrideScore" => @policy.override_score?,
          "canRelease" => @policy.release?,
          "canAcknowledge" => @policy.acknowledge?,
          "canManageCompensation" => @policy.manage_compensation?,
          "canSetManagementOnlyComment" => AppraisalCommentPolicy.new(@user, @appraisal).may_set_management_only?,
          "visibleRevisionStages" => @policy.visible_revision_stages
        }
      end
  end
end
