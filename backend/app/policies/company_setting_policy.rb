# Company-wide preferences. Reading is open to anyone who may add an employee —
# the add form prefills the next code and has to ask for it — while changing
# the pattern every future code follows is an administrative act.
class CompanySettingPolicy < ApplicationPolicy
  def show? = permission?("employees.view") || permission?("employees.create")
  def update? = permission?("employees.manage_roles") || permission?("settings.manage")
end
