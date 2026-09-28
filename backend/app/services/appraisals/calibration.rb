module Appraisals
  # The organisation-level view a Final Reviewer calibrates from (scope §16).
  #
  # One row per appraisal: employee, role, SELF rating, MANAGER rating, weighted
  # score and final rating — the four numbers side by side, which is the whole
  # point. A row is flagged when those numbers disagree more than they usually
  # would, so attention goes where it is actually warranted.
  #
  # Explicitly NOT a forced distribution. The scope is clear that calibration is
  # "intended to improve consistency, not force a predetermined rating
  # distribution", so nothing here ranks, curves or caps anybody — it only
  # surfaces gaps for a human to look at.
  class Calibration
    # Two points apart on a five-point scale is a real disagreement, not noise.
    SIGNIFICANT_GAP = 2.0

    def self.call(...) = new(...).call

    def initialize(cycle:)
      @cycle = cycle
    end

    def call
      rows = appraisals.map { |appraisal| build_row(appraisal) }

      {
        rows: rows,
        summary: {
          total: rows.size,
          flagged: rows.count { |row| row[:flagged] },
          awaiting_review: rows.count { |row| row[:manager_rating].nil? },
          released: rows.count { |row| row[:released] },
          # Distribution of the score the workflow actually stands behind,
          # bucketed to whole ratings. Reporting only.
          distribution: distribution(rows)
        }
      }
    end

    private
      def appraisals
        @appraisals ||= @cycle.appraisals
                                        .includes(:employee, { employee: :designation }, :revisions)
                                        .order("employees.last_name")
                                        .to_a
      end

      def build_row(appraisal)
        self_score = score_for(appraisal, "self_appraisal")
        manager_score = score_for(appraisal, "manager_review", level: 1)
        gap = self_score && manager_score ? (self_score - manager_score).round(2) : nil

        {
          appraisal_id: appraisal.id,
          employee_id: appraisal.employee_id,
          employee_name: appraisal.employee.full_name,
          employee_code: appraisal.employee.employee_code,
          designation: appraisal.employee.designation&.title,
          current_level: appraisal.employee.current_level,
          status: appraisal.status,
          self_rating: self_score,
          manager_rating: manager_score,
          weighted_score: appraisal.calculated_score&.to_f,
          final_rating: appraisal.effective_score&.to_f,
          overridden: appraisal.overridden?,
          gap: gap,
          flagged: gap.present? && gap.abs >= SIGNIFICANT_GAP,
          # The first and last manager levels of the reviewer chain.
          primary_manager: reviewer_names[appraisal.reviewer_ids.first],
          final_manager: reviewer_names[appraisal.reviewer_ids.last],
          released: appraisal.released?
        }
      end

      # Every reviewer on every appraisal in the cohort, loaded once.
      def reviewer_names
        @reviewer_names ||= Employee.where(id: appraisals.flat_map(&:reviewer_ids).uniq)
                                    .to_h { |employee| [ employee.id, employee.full_name ] }
      end

      def score_for(appraisal, stage, level: nil)
        appraisal.revisions.select { |revision| revision.stage == stage && (level.nil? || revision.review_level == level) }
                 .max_by(&:version_number)&.calculated_score&.to_f
      end

      def distribution(rows)
        rows.filter_map { |row| row[:final_rating]&.round }
            .tally
            .sort.to_h
      end
  end
end
