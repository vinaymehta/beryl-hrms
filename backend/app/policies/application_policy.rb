class ApplicationPolicy
  attr_reader :user, :record

  def initialize(user, record)
    @user = user
    @record = record
  end

  def index? = false
  def show? = false
  def create? = false
  def update? = false
  def destroy? = false

  class Scope
    attr_reader :user, :scope

    def initialize(user, scope)
      @user = user
      @scope = scope
    end

    def resolve
      raise NoMethodError, "You must define #resolve in #{self.class}"
    end
  end

  private
    # The one check every policy in this app is built on: never authorize
    # across a tenant boundary, regardless of what permission a user holds.
    # Checked before any permission lookup so a same-company requirement
    # can never be accidentally omitted by a specific policy.
    def same_company?
      return false if user.nil? || record.nil?

      record_company_id = record.respond_to?(:company_id) ? record.company_id : nil
      record_company_id.nil? || record_company_id == user.company_id
    end

    def permission?(key)
      same_company? && Current.permissions.include?(key.to_s)
    end
end
