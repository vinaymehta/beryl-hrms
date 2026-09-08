require "rails_helper"

# The concrete answer to "how does tenant isolation break in production": a
# model gets a company_id column and someone forgets to declare
# acts_as_tenant on it. This spec fails the build the moment that happens,
# rather than relying on someone noticing in review.
RSpec.describe "Tenant scoping", type: :model do
  before(:all) { Rails.application.eager_load! }

  # AuditLog has a nullable company_id (platform-level events have none) and
  # is deliberately exempt — see the comment on the model. Every other
  # company_id column must mean acts_as_tenant.
  DELIBERATELY_UNSCOPED = %w[AuditLog].freeze

  let(:tenant_owned_models) do
    ApplicationRecord.descendants.select do |klass|
      klass.table_exists? && klass.column_names.include?("company_id") &&
        !DELIBERATELY_UNSCOPED.include?(klass.name)
    end
  end

  it "declares acts_as_tenant on every model with a company_id column" do
    not_scoped = tenant_owned_models.reject do |klass|
      klass.respond_to?(:scoped_by_tenant?) && klass.scoped_by_tenant?
    end

    expect(not_scoped).to eq([]),
      "these models have a company_id column but don't declare acts_as_tenant: " \
      "#{not_scoped.map(&:name).join(', ')}"
  end

  it "found at least the models this pass actually defines (sanity check the introspection itself works)" do
    expect(tenant_owned_models.map(&:name)).to include(
      "User", "Employee", "Department", "Designation", "Role", "UserRole", "ZohoConnection"
    )
  end
end
