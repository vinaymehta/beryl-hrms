# The shared CRUD for everything nested under /employees/:employee_id/…
#
# All seven of these controllers differ only in their model, their association
# and their permitted params, so the actions live here once. Each controller
# declares the three differences and nothing else.
#
# Payloads are camelised `as_json` rather than an Alba resource per model: these
# are flat records with no nested shapes, so seven near-identical serializer
# classes would be seven files earning nothing. The camelCase API contract
# (docs/API_CONVENTIONS.md) is still honoured.
module EmployeeSubresource
  extend ActiveSupport::Concern

  class_methods do
    # @param model [Class]
    # @param association [Symbol] the Employee has_many to write through
    # @param params [Array] permitted attribute names
    # @param methods [Array] extra methods to include in the payload
    # @param order [Symbol] scope applied to #index. Needed because the action
    #   queries the model directly rather than through the Employee
    #   association, so the association's own ordering does not apply — and
    #   unordered history is useless history.
    def employee_subresource(model:, association:, params:, methods: [], order: :newest_first)
      define_method(:record_class) { model }
      define_method(:association_name) { association }
      define_method(:permitted_keys) { params }
      define_method(:serialized_methods) { methods }
      define_method(:list_order) { order }
    end
  end

  included do
    before_action :load_employee
  end

  def index
    authorize record_class
    records = policy_scope(record_class).where(employee_id: @employee.id).public_send(list_order)
    render_data(serialize(records.to_a))
  end

  def create
    authorize record_class
    record = @employee.public_send(association_name).new(record_params)
    record.save!
    audit(record, "created")
    render_data(serialize(record), status: :created)
  end

  def update
    record = find_record
    authorize record
    record.update!(record_params)
    audit(record, "updated")
    render_data(serialize(record))
  end

  def destroy
    record = find_record
    authorize record
    record.destroy!
    audit(record, "deleted")
    head :no_content
  end

  private
    # Through the Employee policy scope, so someone who may not see this
    # employee at all gets a 404 rather than a hint that they exist.
    def load_employee
      @employee = policy_scope(Employee).find(params[:employee_id])
    end

    def find_record
      policy_scope(record_class).where(employee_id: @employee.id).find(params[:id])
    end

    def record_params
      params.permit(*permitted_keys)
    end

    def serialize(records)
      if records.is_a?(Array)
        records.map { |record| camelize(record) }
      else
        camelize(records)
      end
    end

    def camelize(record)
      record.as_json(methods: serialized_methods).deep_transform_keys { |key| key.to_s.camelize(:lower) }
    end

    def audit(record, action)
      ::Audit::Record.call(
        action: "#{record.class.name.underscore}.#{action}", auditable: record, request: request
      )
    end
end
