# Structured interviewer feedback. The existing feedback_rating stays as the
# OVERALL rating and feedback_comments as the overall comments, so rows
# submitted on the old form still read correctly; feedback_would_recommend is
# kept for those rows even though the new form records a decision instead.
#
# feedback_reminder_sent_at lets InterviewFeedbackRemindersJob send exactly one
# reminder per request.
class AddStructuredInterviewFeedbackToCandidates < ActiveRecord::Migration[8.1]
  def change
    change_table :candidates, bulk: true do |t|
      t.integer :feedback_technical_rating
      t.integer :feedback_communication_rating
      t.integer :feedback_problem_solving_rating
      t.integer :feedback_culture_fit_rating
      t.text :feedback_strengths
      t.text :feedback_weaknesses
      t.integer :feedback_decision
      t.datetime :feedback_reminder_sent_at
    end
  end
end
