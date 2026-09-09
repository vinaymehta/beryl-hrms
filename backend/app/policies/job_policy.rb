class JobPolicy < ApplicationPolicy
  def index?
    permission?("recruitment.view") || permission?("jobs.view")
  end

  def show?
    same_company? && (permission?("recruitment.view") || permission?("jobs.view"))
  end

  def create?
    same_company? && (permission?("recruitment.manage") || permission?("jobs.manage"))
  end

  def update?
    create?
  end

  def destroy?
    create?
  end

  def match_candidates?
    show?
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
