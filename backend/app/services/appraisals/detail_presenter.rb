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
        "template" => template_payload,
        "revisions" => Api::V1::AppraisalRevisionSerializer.new(visible_revisions).as_json,
        "comments" => Api::V1::AppraisalCommentSerializer.new(visible_comments).as_json,
        "transitions" => Api::V1::AppraisalTransitionSerializer.new(@appraisal.transitions.to_a).as_json,
        "scoreOverrides" => Api::V1::AppraisalScoreOverrideSerializer.new(@appraisal.score_overrides.to_a).as_json,
        "selfAppraisalDraft" => self_appraisal_draft,
        "reviewDraft" => review_draft,
        "discussion" => discussion_payload,
        # The subject's own compact record, for the page header (job title,
        # department, employee code). Same serializer the reporting line
        # already uses, so it carries no more than a manager's entry does —
        # and anyone who can open this appraisal can already see whose it is.
        "employee" => manager_summary(@appraisal.employee),
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

        # Camelised on the way OUT, because it was underscored on the way in.
        #
        # Incoming JSON keys are underscored globally (config/initializers/
        # json_key_transform.rb), so a draft saved from the form is stored as
        # question_id / improvement_areas. Handed back as-is it no longer
        # matched the form that wrote it: `questionId` read as undefined, and
        # the string "undefined" then went out as a question id on submit —
        # "Question undefined does not belong to this appraisal's template".
        # The narrative failed more quietly still, simply not reloading.
        #
        # `responses` is deliberately left alone. Its keys are workbook field
        # keys defined by whoever built the spreadsheet, not attribute names,
        # and camelising them would rename the fields themselves.
        {
          "answers" => Array(draft["answers"]).map { |answer| camelize_keys(answer) },
          "narrative" => camelize_keys(draft["narrative"] || {}),
          "responses" => draft["responses"] || {},
          "step" => draft["step"],
          "savedAt" => @appraisal.self_appraisal_draft_saved_at
        }
      end

      # The viewer's own unsubmitted review at the stage the appraisal is at —
      # and only if they wrote it. Same shape as the self draft, so the form
      # reloads either the same way.
      def review_draft
        return nil unless @policy.save_review_draft?

        draft = @appraisal.review_drafts[@appraisal.review_draft_key]
        return nil if draft.blank? || draft["author_user_id"] != @user&.id

        {
          "answers" => Array(draft["answers"]).map { |answer| camelize_keys(answer) },
          "narrative" => camelize_keys(draft["narrative"] || {}),
          "responses" => draft["responses"] || {},
          "step" => draft["step"],
          "savedAt" => draft["saved_at"]
        }
      end

      # The Discussion step's decision — Admin/HR only, never the employee.
      def discussion_payload
        return nil unless @policy.administrator?

        decision = @appraisal.compensation_decision
        promote = case decision&.promotion_recommendation
        when "recommended" then true
        when "not_recommended" then false
        end
        pay_record = latest_pay_record
        {
          # Previous income: what was saved, or — until something is — the
          # employee's latest pay record, so Admin/HR start from the real figure.
          "currentCompensation" => (decision&.current_compensation || pay_record&.annual_compensation)&.to_s,
          "currentCompensationPrefilled" => decision&.current_compensation.nil? && pay_record&.annual_compensation.present?,
          "incrementPercentage" => decision&.approved_increment_percentage&.to_s,
          "approvedCompensation" => decision&.approved_compensation&.to_s,
          # Pay records carry no incentive column, so there is nothing to
          # pre-fill the current incentive from.
          "currentIncentive" => decision&.current_incentive&.to_s,
          "approvedIncentive" => decision&.approved_incentive&.to_s,
          "promote" => promote,
          "proposedDesignationId" => decision&.proposed_designation_id&.to_s,
          "proposedDesignationTitle" => decision&.proposed_designation&.title,
          "promotionReason" => decision&.promotion_reason,
          "canEdit" => @policy.save_discussion?
        }
      end

      # The employee's most recent compensation record that states an amount,
      # for the pre-fill. Only while the decision can still be edited — once
      # released, an unsaved figure stays unsaved rather than looking decided —
      # and only for a viewer who may read pay records at all
      # (compensation.manage). HR holds appraisals.view_all without it, and the
      # Discussion step must not become a side door onto anyone's pay history.
      def latest_pay_record
        return nil unless @policy.save_discussion? && @appraisal.employee

        record = @appraisal.employee.compensation_records.where.not(annual_compensation: nil).first
        record if record && EmployeeCompensationRecordPolicy.new(@user, record).show?
      end

      def camelize_keys(hash)
        hash.to_h { |key, value| [ key.to_s.camelize(:lower), value ] }
      end

      def frozen_template
        @appraisal.appraisal_cycle.appraisal_template
      end

      # The template, with the perspective block's MANAGER columns removed for
      # anyone who isn't management.
      #
      # The workbook's PERFORMANCE PERSPECTIVE table carries a Manager Rating
      # and a Manager Summary / Evidence alongside each perspective's weight
      # and focus. Those are the reviewer's assessment, not part of the form
      # the employee fills in, so they are stripped here rather than hidden in
      # the UI — the employee's response never carries them at all.
      #
      # The weights (60/25/15) and the assessment focus stay: they are what the
      # TEMPLATE says the appraisal is weighted on, not anyone's rating, and
      # the employee is entitled to know how their appraisal is composed.
      def template_payload
        payload = Api::V1::AppraisalTemplateSerializer.new(frozen_template).as_json
        return payload if may_see_manager_assessment?

        structure = payload["structure"]
        return payload if structure.blank?

        payload.merge("structure" => structure.merge(
          "perspectives" => Array(structure["perspectives"]).map { |row| row.except("managerRating", "managerSummary") },
          "wizardSections" => Array(structure["wizardSections"]).map do |section|
            next section unless section["kind"] == "perspectives"

            section.merge("fields" => Array(section["fields"]).map { |field| field.except("managerRating", "managerSummary") })
          end
        ))
      end

      # Management for THIS appraisal: an assigned reviewer at any level, or an
      # appraisals.view_all holder. Being an employee somewhere else does not
      # make you management here.
      def may_see_manager_assessment?
        @policy.administrator? || @policy.reviewer?
      end

      def visible_revisions
        stages = @policy.visible_revision_stages
        return [] if stages.empty?

        @appraisal.revisions.where(stage: stages).includes(:answers, :author_employee, :author_user)
                  .select { |revision| @policy.visible_revision?(revision) }
      end

      def visible_comments
        AppraisalCommentPolicy::Scope
          .new(@user, @appraisal.comments)
          .resolve
          .includes(:author_user)
          .newest_first
          .to_a
      end



      # Names only — the reviewer chain is not sensitive, and the employee is
      # explicitly allowed to see who their managers are.
      # The reviewer chain, level 1 first.
      def managers_payload
        @appraisal.reviewers.each_with_index.map do |employee, index|
          { "level" => index + 1, "employee" => manager_summary(employee) }
        end
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
          "canSaveReviewDraft" => @policy.save_review_draft?,
          "canSubmitSelf" => @policy.submit_self?,
          # Only computed for the person who would submit — nobody else is blocked by it.
          "missingIdentityDocuments" => @policy.submit_self? ? @appraisal.employee.missing_identity_documents : [],
          "canSubmitReview" => @policy.submit_review?,
          "canReturnForCorrection" => @policy.return_for_correction?,
          "canAdvance" => @policy.advance?,
          "canOverrideScore" => @policy.override_score?,
          "canRelease" => @policy.release?,
          "canAcknowledge" => @policy.acknowledge?,
          "canSetManagementOnlyComment" => AppraisalCommentPolicy.new(@user, @appraisal).may_set_management_only?,
          "visibleRevisionStages" => @policy.visible_revision_stages
        }
      end
  end
end
