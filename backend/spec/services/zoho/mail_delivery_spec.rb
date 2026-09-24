require "rails_helper"

# Outgoing transactional mail sent through the Zoho Mail API rather than SMTP.
#
# The behaviour worth pinning here is WHICH mailbox a given message leaves
# from. This is a multi-tenant app: an invitation to Acme's new joiner must go
# out of Acme's connected mailbox, and picking "whichever connection exists"
# would work perfectly on a single-tenant dev database and leak one company's
# sender identity into another's mail in production.
RSpec.describe Zoho::MailDelivery do
  let(:client) { instance_double(Zoho::Client) }
  let(:sent) { [] }

  before do
    allow(Zoho::Client).to receive(:new).and_return(client)
    allow(client).to receive(:fetch_account_id).and_return("acct-1")
    allow(client).to receive(:refresh_access_token)
      .and_return({ access_token: "refreshed", refresh_token: "r", expires_in: 3600 })
    allow(client).to receive(:send_message) { |**args| sent << args; { "status" => "success" } }
    Rails.cache.clear
  end

  def company_with_user(name, email, connection: :company_managed, mailbox: nil)
    company = Company.create!(name: name)
    ActsAsTenant.with_tenant(company) do
      user = create(:user, company: company, email_address: email)
      if connection
        create(:zoho_connection, company: company, connection_type: connection,
                                 email_address: mailbox || "mail@#{name.parameterize}.test")
      end
      user
    end
  end

  def deliver(to:, subject: "Hello", html: "<p>Hi</p>")
    mail = Mail.new do
      to to
      from "ignored@example.com"
      subject subject
    end
    mail.html_part = Mail::Part.new { content_type "text/html; charset=UTF-8"; body html }
    mail.text_part = Mail::Part.new { body "plain text" }
    described_class.new.deliver!(mail)
    mail
  end

  describe "choosing the mailbox" do
    it "sends out of the recipient's own company mailbox" do
      company_with_user("Acme", "joiner@acme.test", mailbox: "hr@acme.test")

      deliver(to: "joiner@acme.test")

      expect(sent.last[:from_address]).to eq("hr@acme.test")
      expect(sent.last[:to_address]).to eq("joiner@acme.test")
    end

    it "does not reach for another company's mailbox" do
      company_with_user("Globex", "someone@globex.test", mailbox: "mail@globex.test")
      company_with_user("Initech", "joiner@initech.test", mailbox: "mail@initech.test")

      deliver(to: "joiner@initech.test")

      expect(sent.last[:from_address]).to eq("mail@initech.test")
    end

    it "prefers a shared company mailbox over one person's" do
      company = Company.create!(name: "Umbrella")
      ActsAsTenant.with_tenant(company) do
        create(:user, company: company, email_address: "joiner@umbrella.test")
        create(:zoho_connection, company: company, connection_type: :individual,
                                 email_address: "priya@umbrella.test")
        create(:zoho_connection, company: company, connection_type: :company_managed,
                                 email_address: "noreply@umbrella.test")
      end

      deliver(to: "joiner@umbrella.test")

      expect(sent.last[:from_address]).to eq("noreply@umbrella.test")
    end

    it "falls back to an individual mailbox when that is all the company has" do
      # The ordinary state of a company that has connected one person's inbox
      # and nothing else — its invitations still have to go somewhere.
      company = Company.create!(name: "Soylent")
      ActsAsTenant.with_tenant(company) do
        create(:user, company: company, email_address: "joiner@soylent.test")
        create(:zoho_connection, company: company, connection_type: :individual,
                                 email_address: "nitin@soylent.test")
      end

      deliver(to: "joiner@soylent.test")

      expect(sent.last[:from_address]).to eq("nitin@soylent.test")
    end

    it "ignores a revoked connection" do
      company = Company.create!(name: "Tyrell")
      ActsAsTenant.with_tenant(company) do
        create(:user, company: company, email_address: "joiner@tyrell.test")
        create(:zoho_connection, company: company, status: :revoked, email_address: "dead@tyrell.test")
      end

      expect { deliver(to: "joiner@tyrell.test") }.to raise_error(described_class::NoMailboxError)
    end

    it "honours MAIL_FROM when it names a connected mailbox" do
      company_with_user("Acme", "joiner@acme.test", mailbox: "hr@acme.test")
      other = Company.create!(name: "Pinned")
      ActsAsTenant.with_tenant(other) do
        create(:zoho_connection, company: other, email_address: "pinned@ops.test")
      end

      allow(ENV).to receive(:[]).and_call_original
      allow(ENV).to receive(:[]).with("MAIL_FROM").and_return("pinned@ops.test")

      deliver(to: "joiner@acme.test")

      expect(sent.last[:from_address]).to eq("pinned@ops.test")
    end

    it "raises rather than silently dropping the message when nothing is connected" do
      company_with_user("Nothing", "joiner@nothing.test", connection: nil)

      # The whole point: the bug this replaces was mail that reported success
      # and went nowhere. In a Sidekiq job a raise is a visible, retrying
      # failure — silence is not an option worth having.
      expect { deliver(to: "joiner@nothing.test") }
        .to raise_error(described_class::NoMailboxError, /No active Zoho mailbox/)
    end

    it "raises for a recipient who is not a user of any company" do
      expect { deliver(to: "stranger@elsewhere.test") }
        .to raise_error(described_class::NoMailboxError)
    end
  end

  describe "what it sends" do
    before { company_with_user("Acme", "joiner@acme.test", mailbox: "hr@acme.test") }

    it "sends the HTML part, not the plain-text fallback" do
      deliver(to: "joiner@acme.test", html: "<p>Set your <b>password</b></p>")

      expect(sent.last[:content]).to eq("<p>Set your <b>password</b></p>")
      expect(sent.last[:content]).not_to include("plain text")
    end

    it "carries the subject through" do
      deliver(to: "joiner@acme.test", subject: "You've been invited")

      expect(sent.last[:subject]).to eq("You've been invited")
    end

    it "joins multiple recipients the way Zoho expects" do
      ActsAsTenant.with_tenant(Company.find_by!(name: "Acme")) do
        create(:user, company: Company.find_by!(name: "Acme"), email_address: "second@acme.test")
      end

      deliver(to: [ "joiner@acme.test", "second@acme.test" ])

      expect(sent.last[:to_address]).to eq("joiner@acme.test,second@acme.test")
    end

    it "wraps a text-only message so it still lays out as mail" do
      mail = Mail.new { to "joiner@acme.test"; subject "Plain"; body "line one\nline two" }
      described_class.new.deliver!(mail)

      expect(sent.last[:content]).to include("line one\nline two")
      expect(sent.last[:content]).to start_with("<pre")
    end
  end

  describe "the token" do
    it "refreshes one that is about to expire, and sends with the new one" do
      company = Company.create!(name: "Stale")
      ActsAsTenant.with_tenant(company) do
        create(:user, company: company, email_address: "joiner@stale.test")
        create(:zoho_connection, company: company, email_address: "mail@stale.test",
                                 access_token: "old", token_expires_at: 1.minute.from_now)
      end

      deliver(to: "joiner@stale.test")

      expect(client).to have_received(:refresh_access_token)
      expect(sent.last[:access_token]).to eq("refreshed")
    end

    it "leaves a healthy token alone" do
      company = Company.create!(name: "Fresh")
      ActsAsTenant.with_tenant(company) do
        create(:user, company: company, email_address: "joiner@fresh.test")
        create(:zoho_connection, company: company, email_address: "mail@fresh.test",
                                 access_token: "good", token_expires_at: 2.hours.from_now)
      end

      deliver(to: "joiner@fresh.test")

      expect(client).not_to have_received(:refresh_access_token)
      expect(sent.last[:access_token]).to eq("good")
    end
  end

  describe "wired into ActionMailer" do
    it "is registered under the name the environment files select it by" do
      expect(ActionMailer::Base.delivery_methods).to include(:zoho)
    end

    it "delivers a real application mail end to end" do
      user = company_with_user("Acme", "joiner@acme.test", mailbox: "hr@acme.test")

      # Selected by NAME, the way an environment file does it, so the
      # initializer's registration is part of what is under test.
      previous = ActionMailer::Base.delivery_method
      begin
        ActionMailer::Base.delivery_method = :zoho
        ActsAsTenant.with_tenant(user.company) { UserMailer.invitation(user).deliver_now }
      ensure
        ActionMailer::Base.delivery_method = previous
      end

      expect(sent.last[:to_address]).to eq("joiner@acme.test")
      expect(sent.last[:from_address]).to eq("hr@acme.test")
      expect(sent.last[:content]).to include("accept-invitation?token=")
    end
  end
end
