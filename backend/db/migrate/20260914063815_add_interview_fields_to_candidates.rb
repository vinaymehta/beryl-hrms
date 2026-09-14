class AddInterviewFieldsToCandidates < ActiveRecord::Migration[8.1]
  # The interview stage carries exactly one scheduled slot per candidate —
  # there are no rounds, phases or multi-stage models, and rescheduling
  # overwrites in place rather than appending history. That makes columns on
  # candidates the right shape; a separate interviews table would only pay
  # off once more than one interview per candidate has to exist.
  def change
    # Date and time are collected as two fields in the UI but stored as one
    # instant, so ordering/comparison is a plain timestamp comparison.
    add_column :candidates, :interview_at, :datetime
    add_reference :candidates, :interviewer, null: true, foreign_key: { to_table: :employees }

    # When the feedback request was last sent to the candidate. Distinct from
    # the status: it records that the ask went out, while the status records
    # whether anything came back.
    add_column :candidates, :feedback_requested_at, :datetime
  end
end
