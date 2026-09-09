class CandidateResumePolicy < ApplicationPolicy
  def index?
    permission?("recruitment.view") || permission?("resumes.view")
  end

  def show?
    same_company? && (permission?("recruitment.view") || permission?("resumes.view"))
  end

  def create?
    same_company? && (permission?("recruitment.manage") || permission?("resumes.process"))
  end

  def reprocess?
    same_company? && (permission?("recruitment.manage") || permission?("resumes.process"))
  end

  def download?
    show?
  end

  def destroy?
    same_company? && permission?("recruitment.manage")
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
