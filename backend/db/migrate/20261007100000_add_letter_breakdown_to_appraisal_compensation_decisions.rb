# The Discussion decision now follows the appraisal letter's compensation
# table: a monthly breakdown (basic, HRA, EPF, conveyance, special allowance,
# incentive, others) whose earnings add up to the new monthly gross, and the
# date the next appraisal is due, which the letter states.
#
# current_compensation / approved_compensation are reused as the current and
# new MONTHLY gross. current_incentive / approved_incentive stay where they
# are, unused — incentive is a row of the breakdown now — so nothing already
# saved is lost.
class AddLetterBreakdownToAppraisalCompensationDecisions < ActiveRecord::Migration[8.1]
  def change
    add_column :appraisal_compensation_decisions, :compensation_breakdown, :jsonb, null: false, default: {}
    add_column :appraisal_compensation_decisions, :next_appraisal_on, :date
  end
end
