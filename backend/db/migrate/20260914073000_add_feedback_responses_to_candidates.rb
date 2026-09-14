class AddFeedbackResponsesToCandidates < ActiveRecord::Migration[8.1]
  def change
    # One interview per candidate means one feedback per candidate, so these
    # live on the row rather than in a join table — same reasoning as the
    # interview_at/interviewer_id columns added alongside them.
    #
    # feedback_token is the candidate's unguessable key to the public form:
    # it is the ONLY credential on that endpoint, so it is indexed unique and
    # generated with SecureRandom rather than derived from anything guessable.
    add_column :candidates, :feedback_token, :string
    add_index :candidates, :feedback_token, unique: true

    add_column :candidates, :feedback_rating, :integer
    add_column :candidates, :feedback_would_recommend, :boolean
    add_column :candidates, :feedback_comments, :text
    add_column :candidates, :feedback_submitted_at, :datetime
  end
end
