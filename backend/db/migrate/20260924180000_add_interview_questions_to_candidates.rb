class AddInterviewQuestionsToCandidates < ActiveRecord::Migration[8.1]
  def change
    # The generated set, kept so every interviewer opens the SAME questions and
    # a second look costs nothing. JSONB rather than a child table because a
    # set is read and replaced whole, never queried into — regenerating
    # overwrites it, and there is no history worth keeping.
    add_column :candidates, :interview_questions, :jsonb

    # When, and against which job. The job matters: the same person asked about
    # the same resume gets different questions for a backend role than for a
    # lead one, so the panel has to be able to say which it was.
    add_column :candidates, :interview_questions_generated_at, :datetime
    add_reference :candidates, :interview_questions_job, foreign_key: { to_table: :jobs }, null: true
  end
end
