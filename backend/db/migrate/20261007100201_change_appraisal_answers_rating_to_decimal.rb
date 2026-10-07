# Half-star ratings: an answer can now be 1, 1.5, 2 … 4.5, 5. Precision 3 /
# scale 1 holds exactly that and nothing finer; AppraisalAnswer enforces the
# 0.5 step itself.
#
# Every existing whole-number rating converts to the same value (4 → 4.0).
# Rolling back rounds a half up to the next whole rating (3.5 → 4), since an
# integer column has nowhere to keep it.
class ChangeAppraisalAnswersRatingToDecimal < ActiveRecord::Migration[8.1]
  def up
    change_column :appraisal_answers, :rating, :decimal, precision: 3, scale: 1
  end

  def down
    change_column :appraisal_answers, :rating, :integer, using: "round(rating)::integer"
  end
end
