require "rails_helper"

# The single most important spec in the suite given the "never trust the
# frontend" hard requirement: proves the two layers documented in
# docs/ARCHITECTURE.md actually hold, using Employee as a representative
# tenant-owned model. Once Phase 5 adds real CRUD endpoints, each gets its
# own request-level "company A gets 404 on company B's record by id" spec on
# top of this — this is the mechanism those will all be relying on.
RSpec.describe "Tenant isolation", type: :model do
  let(:company_a) { create(:company) }
  let(:company_b) { create(:company) }
  let!(:employee_a) { ActsAsTenant.with_tenant(company_a) { create(:employee, company: company_a, employee_code: "A-1") } }
  let!(:employee_b) { ActsAsTenant.with_tenant(company_b) { create(:employee, company: company_b, employee_code: "B-1") } }

  it "fails CLOSED with no tenant set (raises, does not silently return unscoped data)" do
    expect { Employee.find(employee_a.id) }.to raise_error(ActsAsTenant::Errors::NoTenantSet)
  end

  it "scopes .all to only the current tenant's records" do
    ActsAsTenant.with_tenant(company_a) do
      expect(Employee.all).to contain_exactly(employee_a)
    end
  end

  it "never resolves another company's record by id, even a valid one" do
    ActsAsTenant.with_tenant(company_a) do
      expect { Employee.find(employee_b.id) }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  it "auto-assigns company_id from the current tenant on create" do
    employee = ActsAsTenant.with_tenant(company_a) { Employee.create!(employee_code: "A-2", first_name: "A", last_name: "B") }
    expect(employee.company_id).to eq(company_a.id)
  end
end
