class CandidatePolicy < ApplicationPolicy
  def index?
    permission?("recruitment.view") || permission?("candidates.view")
  end

  def show?
    same_company? && (permission?("recruitment.view") || permission?("candidates.view"))
  end

  def create?
    same_company? && (permission?("recruitment.manage") || permission?("candidates.manage"))
  end

  def update?
    same_company? && (permission?("recruitment.manage") || permission?("candidates.manage"))
  end

  def destroy?
    same_company? && (permission?("recruitment.manage") || permission?("candidates.manage"))
  end

  def shortlist?
    update?
  end

  # Reading the questions is reading the candidate. GENERATING them spends
  # money at an AI provider and overwrites what the last interviewer saw, so it
  # rides on the heavier right.
  def interview_questions? = show?
  def generate_interview_questions? = update?

  def reject?
    update?
  end

  def status?
    update?
  end

  # Interview stage. Same permission as any other candidate mutation — these
  # are named explicitly (rather than authorized as :update?) so the interview
  # workflow can be gated separately later without touching the controller.
  def schedule_interview?
    update?
  end

  def request_feedback?
    update?
  end

  class Scope < Scope
    def resolve
      if user.present?
        scope.where(company_id: user.company_id)
      else
        scope.none
      end
    end
  end
end
