require "rails_helper"

RSpec.describe DocumentPolicy do
  let(:company) { create(:company) }
  let(:other_company) { create(:company) }

  def sign_in_as(user)
    Current.reset # a prior sign_in_as in the same example would otherwise leave Current.permissions memoized from the previous user
    ActsAsTenant.current_tenant = user.company
    Current.session = ActsAsTenant.with_tenant(user.company) { user.sessions.create! }
  end

  def user_with_permissions(company, *keys)
    user = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
    role = ActsAsTenant.with_tenant(company) { create(:role, company: company) }
    role.permissions = Permission.where(key: keys)
    ActsAsTenant.with_tenant(company) { create(:user_role, user: user, role: role, company: company) }
    user
  end

  # An employee login: a user with an Employee row of their own.
  def employee_user(company, *keys)
    user = user_with_permissions(company, *keys)
    ActsAsTenant.with_tenant(company) { create(:employee, company: company, user: user) }
    user
  end

  def document_for(employee, company:)
    ActsAsTenant.with_tenant(company) do
      create_document(company: company, employee: employee)
    end
  end

  def create_document(company:, employee:)
    Document.create!(
      company: company,
      employee: employee,
      uploaded_by: employee&.user || ActsAsTenant.with_tenant(company) { create(:user, company: company) },
      title: "Aadhaar.pdf",
      document_type: "aadhaar"
    )
  end

  describe "uploading against a particular employee" do
    it "lets documents.create file against anyone" do
      hr = user_with_permissions(company, "documents.view", "documents.create")
      someone_else = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      sign_in_as(hr)

      expect(described_class.new(hr, Document).upload_for?(someone_else.id)).to be true
    end

    # The whole point of the separate permission: an employee may upload, but
    # only ever onto their own record.
    it "confines documents.manage_own to the uploader's own record" do
      user = employee_user(company, "documents.view", "documents.manage_own")
      own = user.employee_record
      colleague = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      sign_in_as(user)

      policy = described_class.new(user, Document)
      expect(policy.create?).to be true
      expect(policy.upload_for?(own.id)).to be true
      expect(policy.upload_for?(colleague.id)).to be false
      # Company-wide documents (no employee) are not theirs to create either.
      expect(policy.upload_for?(nil)).to be false
    end

    it "refuses upload entirely without either permission" do
      user = employee_user(company, "documents.view")
      sign_in_as(user)

      expect(described_class.new(user, Document).create?).to be false
    end
  end

  describe "deleting" do
    # The point of the rule: fix your own mistake without booking HR's time.
    it "lets an employee remove a document they uploaded themselves" do
      user = employee_user(company, "documents.view", "documents.manage_own")
      document = ActsAsTenant.with_tenant(company) do
        Document.create!(company: company, employee: user.employee_record, uploaded_by: user,
                         title: "Wrong file.pdf", document_type: "pan")
      end
      sign_in_as(user)

      expect(described_class.new(user, document).destroy?).to be true
    end

    # Same record, different uploader: HR's copy of their contract is not
    # theirs to remove.
    it "refuses a document on their own record that someone else uploaded" do
      user = employee_user(company, "documents.view", "documents.manage_own")
      hr = ActsAsTenant.with_tenant(company) { create(:user, company: company) }
      document = ActsAsTenant.with_tenant(company) do
        Document.create!(company: company, employee: user.employee_record, uploaded_by: hr,
                         title: "Signed contract.pdf", document_type: "employment_contract")
      end
      sign_in_as(user)

      expect(described_class.new(user, document).destroy?).to be false
    end

    it "still lets documents.delete remove anything" do
      hr = user_with_permissions(company, "documents.view", "documents.create", "documents.delete")
      someone = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      document = document_for(someone, company: company)
      sign_in_as(hr)

      expect(described_class.new(hr, document).destroy?).to be true
    end

    it "refuses deletion without either permission" do
      user = employee_user(company, "documents.view")
      document = ActsAsTenant.with_tenant(company) do
        Document.create!(company: company, employee: user.employee_record, uploaded_by: user,
                         title: "Mine.pdf", document_type: "pan")
      end
      sign_in_as(user)

      expect(described_class.new(user, document).destroy?).to be false
    end
  end

  describe "scope" do
    it "shows an employee only their own documents" do
      user = employee_user(company, "documents.view", "documents.manage_own")
      colleague = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      mine = document_for(user.employee_record, company: company)
      theirs = document_for(colleague, company: company)
      sign_in_as(user)

      visible = ActsAsTenant.with_tenant(company) { described_class::Scope.new(user, Document).resolve.to_a }

      expect(visible).to include(mine)
      expect(visible).not_to include(theirs)
    end

    # upload_own must buy no extra visibility — it is a write right only.
    it "does not let documents.manage_own widen what is visible" do
      user = employee_user(company, "documents.view", "documents.manage_own")
      colleague = ActsAsTenant.with_tenant(company) { create(:employee, company: company) }
      document_for(colleague, company: company)
      sign_in_as(user)

      visible = ActsAsTenant.with_tenant(company) { described_class::Scope.new(user, Document).resolve.to_a }

      expect(visible).to be_empty
    end

    it "shows HR every employee's documents in their own company only" do
      hr = user_with_permissions(company, "documents.view", "documents.create")
      mine = document_for(ActsAsTenant.with_tenant(company) { create(:employee, company: company) }, company: company)
      outsider = document_for(
        ActsAsTenant.with_tenant(other_company) { create(:employee, company: other_company) },
        company: other_company
      )
      sign_in_as(hr)

      visible = ActsAsTenant.with_tenant(company) { described_class::Scope.new(hr, Document).resolve.to_a }

      expect(visible).to include(mine)
      expect(visible).not_to include(outsider)
    end
  end
end
