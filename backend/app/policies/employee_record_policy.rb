# Shared policy for everything hanging off an employee profile.
#
# All eight of these answer the same two questions the same way:
#   • may this user administer them company-wide?   → a permission key
#   • may the employee read their OWN?              → yes, unless restricted
#
# So the rule lives here once and each subclass declares only its keys. Writing
# is always administrative: an employee never edits their own skill matrix,
# goals or PIP — §29's least-privilege requirement.
class EmployeeRecordPolicy < ApplicationPolicy
  class_attribute :manage_key, instance_writer: false
  # Defaults to manage_key: for most of these, whoever may write them is also
  # the only audience beyond the employee themselves.
  class_attribute :view_key, instance_writer: false
  # False for records the subject must not read about themselves.
  class_attribute :employee_readable, instance_writer: false, default: true

  def self.reading_key = view_key || manage_key

  def index? = administrator? || own?
  def show? = index?
  def create? = administrator?
  def update? = administrator?
  def destroy? = administrator?

  def administrator? = permission?(self.class.manage_key)

  def own?
    return false unless self.class.employee_readable
    return false unless permission?(self.class.reading_key) || record_is_mine?

    record_is_mine?
  end

  private
    def record_is_mine?
      own_id = user&.employee_record&.id
      return false if own_id.nil?
      return true unless record.respond_to?(:employee_id)

      record.employee_id == own_id
    end

  public

  class Scope < ApplicationPolicy::Scope
    def resolve
      base = scope.where(company_id: user.company_id)
      return base if user.permission?(policy_class.reading_key)
      return base.none unless policy_class.employee_readable

      base.where(employee_id: user.employee_record&.id)
    end

    private
      # Derived from the model being scoped, so a subclass needs no Scope of
      # its own — Pundit inherits this one.
      def policy_class
        model = scope.respond_to?(:klass) ? scope.klass : scope
        "#{model.name}Policy".constantize
      end
  end
end
