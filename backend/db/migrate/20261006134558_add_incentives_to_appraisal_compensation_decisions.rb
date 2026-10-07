# The incentive half of the Discussion decision, alongside the income columns
# the table already has (current_compensation → approved_compensation): what
# the employee's incentive is now, and what Admin/HR decided it becomes.
class AddIncentivesToAppraisalCompensationDecisions < ActiveRecord::Migration[8.1]
  def change
    add_column :appraisal_compensation_decisions, :current_incentive, :decimal, precision: 12, scale: 2
    add_column :appraisal_compensation_decisions, :approved_incentive, :decimal, precision: 12, scale: 2
  end
end
