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

  def reject?
    update?
  end

  def status?
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
