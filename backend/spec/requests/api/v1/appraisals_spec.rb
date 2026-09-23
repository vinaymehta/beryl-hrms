require "rails_helper"

RSpec.describe "Api::V1::Appraisals", type: :request do
  before do
    post "/api/v1/auth/register",
         params: {
           companyName: "Perf Corp", firstName: "Ada", lastName: "Admin",
           email: "perf.admin@acme.test", password: "correct-horse-battery-1",
           passwordConfirmation: "correct-horse-battery-1"
         }.to_json,
         headers: { "Content-Type" => "application/json" }
  end

  let(:company) { Company.find_by!(name: "Perf Corp") }
  let(:json_headers) { { "Content-Type" => "application/json" } }

  def in_tenant(&) = ActsAsTenant.with_tenant(company, &)
  def role(slug) = in_tenant { company.roles.find_by!(slug: slug) }
  def body = response.parsed_body["data"]

  # A staff login with an Employee record of their own.
  def staff(email:, role_slug: "employee", first_name: "Staff", last_name: "Member")
    in_tenant do
      user = create(:user, company: company, email_address: email, password: "correct-horse-battery-1")
      create(:user_role, user: user, role: role(role_slug), company: company)
      create(:employee, company: company, user: user, first_name: first_name, last_name: last_name)
    end
  end

  def login(email)
    post "/api/v1/auth/login",
         params: { email: email, password: "correct-horse-battery-1" }.to_json, headers: json_headers
  end

  def login_admin = login("perf.admin@acme.test")

  # A two-category template totalling 100%, activated and ready for a cycle.
  def build_template!
    in_tenant do
      template = company.appraisal_templates.create!(name: "Annual Review")
      past = template.categories.create!(name: "Delivery", lens: :past, weight: 60, position: 0)
      future = template.categories.create!(name: "Growth", lens: :future_readiness, weight: 40, position: 1)
      past.questions.create!(prompt: "Met commitments", position: 0)
      future.questions.create!(prompt: "Ready for more scope", position: 0)
      template.update!(status: :active)
      template
    end
  end

  # Employee + full manager chain + a started cycle, i.e. the ordinary setup.
  def running_cycle(secondary: false)
    template = build_template!
    primary = staff(email: "primary@acme.test", first_name: "Pat", last_name: "Primary")
    secondary_mgr = staff(email: "secondary@acme.test", first_name: "Sam", last_name: "Second")
    final = staff(email: "final@acme.test", first_name: "Fin", last_name: "Final")
    subject_employee = staff(email: "subject@acme.test", first_name: "Sofia", last_name: "Subject")

    in_tenant do
      assignments = { "primary" => primary.id, "final" => final.id }
      assignments["secondary"] = secondary_mgr.id if secondary
      subject_employee.assign_managers!(assignments)
    end

    login_admin
    post "/api/v1/appraisal_cycles",
         params: {
           name: "FY26 Review", appraisalTemplateId: template.id,
           secondaryReviewEnabled: secondary,
           eligibleEmployeeIds: [ subject_employee.id ]
         }.to_json, headers: json_headers
    cycle_id = body["id"]
    post "/api/v1/appraisal_cycles/#{cycle_id}/start", params: {}.to_json, headers: json_headers

    appraisal = in_tenant { Appraisal.find_by!(appraisal_cycle_id: cycle_id, employee_id: subject_employee.id) }
    { template:, cycle_id:, appraisal:, primary:, secondary: secondary_mgr, final:, subject: subject_employee }
  end

  def question_ids(template)
    in_tenant { template.questions.order(:id).pluck(:id) }
  end

  def submit_self(appraisal, template, ratings: [ 4, 5 ], submit: true)
    post "/api/v1/appraisals/#{appraisal.id}/submit_self",
         params: {
           submit: submit,
           summary: "My year.",
           achievements: "Shipped the thing.",
           answers: question_ids(template).each_with_index.map do |qid, i|
             { questionId: qid, rating: ratings[i], comment: "Evidence #{i}" }
           end
         }.to_json, headers: json_headers
  end

  def submit_review(appraisal, template, ratings: [ 3, 3 ])
    post "/api/v1/appraisals/#{appraisal.id}/submit_review",
         params: {
           summary: "Manager view.",
           answers: question_ids(template).each_with_index.map do |qid, i|
             { questionId: qid, rating: ratings[i], comment: "Manager evidence #{i}" }
           end
         }.to_json, headers: json_headers
  end

  # ---------------------------------------------------------------------------

  describe "templates" do
    it "refuses to activate a template whose weights don't total 100" do
      login_admin
      post "/api/v1/appraisal_templates",
           params: {
             name: "Lopsided", status: "active",
             categoriesAttributes: [
               { name: "A", lens: "past", weight: 60, position: 0 },
               { name: "B", lens: "future_readiness", weight: 30, position: 1 }
             ]
           }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/must total 100/i)
    end

    it "freezes a template once a cycle has started against it" do
      setup = running_cycle
      login_admin

      patch "/api/v1/appraisal_templates/#{setup[:template].id}",
            params: { name: "Renamed" }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/create a new version/i)
    end

    it "carries the question set forward into a new version instead" do
      setup = running_cycle
      login_admin

      post "/api/v1/appraisal_templates/#{setup[:template].id}/new_version",
           params: {}.to_json, headers: json_headers

      expect(response).to have_http_status(:created)
      expect(body["version"]).to eq(2)
      expect(body["status"]).to eq("draft")
      expect(body["categories"].size).to eq(2)
      # The original is untouched, so historical appraisals still read the
      # questions they were answered against.
      expect(in_tenant { setup[:template].reload.version }).to eq(1)
    end
  end

  describe "starting a cycle" do
    it "creates one appraisal per eligible employee with reviewers snapshotted from the hierarchy" do
      setup = running_cycle

      appraisal = setup[:appraisal]
      expect(appraisal.status).to eq("self_appraisal_open")
      expect(appraisal.primary_manager_id).to eq(setup[:primary].id)
      expect(appraisal.final_manager_id).to eq(setup[:final].id)
      # The cycle didn't enable a secondary step, so no secondary is carried.
      expect(appraisal.secondary_manager_id).to be_nil
    end

    it "skips an employee with no primary manager rather than creating a stuck appraisal" do
      template = build_template!
      orphan = staff(email: "orphan@acme.test")
      login_admin

      post "/api/v1/appraisal_cycles",
           params: { name: "C", appraisalTemplateId: template.id, eligibleEmployeeIds: [ orphan.id ] }.to_json,
           headers: json_headers
      post "/api/v1/appraisal_cycles/#{body['id']}/start", params: {}.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(body["createdCount"]).to eq(0)
      expect(body["skipped"].first["reason"]).to match(/no primary manager/i)
    end

    it "notifies the employee that their self-appraisal is open" do
      setup = running_cycle

      notification = in_tenant { Notification.find_by(user_id: setup[:subject].user_id) }
      expect(notification.category).to eq("appraisal.self_appraisal_opened")
    end
  end

  describe "the full V1 → V2 → V3 → Final flow" do
    it "records an immutable revision at every stage, numbered from history" do
      setup = running_cycle(secondary: true)
      appraisal = setup[:appraisal]
      template = setup[:template]

      login("subject@acme.test")
      submit_self(appraisal, template, ratings: [ 5, 4 ])
      expect(response).to have_http_status(:ok)

      login("primary@acme.test")
      submit_review(appraisal, template, ratings: [ 4, 4 ])
      expect(response).to have_http_status(:ok)

      login("secondary@acme.test")
      submit_review(appraisal, template, ratings: [ 3, 4 ])
      expect(response).to have_http_status(:ok)

      login("final@acme.test")
      submit_review(appraisal, template, ratings: [ 4, 3 ])
      expect(response).to have_http_status(:ok)

      summary = in_tenant do
        appraisal.reload.revisions.order(:version_number).map do |revision|
          [ revision.version_number, revision.stage, revision.author_employee.full_name ]
        end
      end
      expect(summary.map(&:first)).to eq([ 1, 2, 3, 4 ])
      expect(summary.map { |row| row[1] }).to eq(%w[self_appraisal primary_review secondary_review final_review])
      expect(summary.map(&:last)).to eq([ "Sofia Subject", "Pat Primary", "Sam Second", "Fin Final" ])
      expect(appraisal.reload.status).to eq("appraisal_discussion")
    end

    it "skips the secondary step when the cycle doesn't enable it" do
      setup = running_cycle(secondary: false)
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template])
      login("primary@acme.test")
      submit_review(appraisal, setup[:template])

      expect(appraisal.reload.status).to eq("final_review")
    end

    it "never overwrites a previous version — a correction adds another" do
      setup = running_cycle
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template], ratings: [ 5, 5 ])
      original = in_tenant { appraisal.revisions.order(:version_number).first }

      login("primary@acme.test")
      patch "/api/v1/appraisals/#{appraisal.id}/return_for_correction",
            params: { notes: "Please add evidence" }.to_json, headers: json_headers
      expect(response).to have_http_status(:ok)

      login("subject@acme.test")
      submit_self(appraisal, setup[:template], ratings: [ 4, 4 ])

      revisions = in_tenant { appraisal.reload.revisions.order(:version_number) }
      expect(revisions.map(&:version_number)).to eq([ 1, 2 ])
      expect(revisions.map(&:stage)).to eq(%w[self_appraisal self_appraisal])
      # V1 still reads exactly as it did.
      expect(in_tenant { original.reload.answers.pluck(:rating) }).to all(eq(5))
    end

    it "refuses to mutate a revision even from the model layer" do
      setup = running_cycle
      login("subject@acme.test")
      submit_self(setup[:appraisal], setup[:template])

      revision = in_tenant { setup[:appraisal].reload.revisions.first }

      expect { in_tenant { revision.update!(summary: "rewritten") } }
        .to raise_error(ActiveRecord::ReadOnlyRecord)
    end

    it "records actor, from, to and timestamp for every transition" do
      setup = running_cycle
      login("subject@acme.test")
      submit_self(setup[:appraisal], setup[:template])

      trail = in_tenant do
        setup[:appraisal].reload.transitions.order(:id).map do |transition|
          {
            to: transition.to_status_name, from: transition.from_status_name,
            actor: transition.actor_user&.email_address, at: transition.created_at
          }
        end
      end
      expect(trail.map { |t| t[:to] }).to eq(%w[self_appraisal_open employee_submitted primary_review])
      expect(trail.last[:from]).to eq("employee_submitted")
      expect(trail.last[:actor]).to eq("subject@acme.test")
      expect(trail).to all(include(at: be_present))
    end
  end

  describe "visibility" do
    it "hides the primary manager's ratings from the employee before release" do
      setup = running_cycle
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template])
      login("primary@acme.test")
      submit_review(appraisal, setup[:template])

      login("subject@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"

      expect(response).to have_http_status(:ok)
      expect(body["revisions"].map { |r| r["stage"] }).to eq([ "self_appraisal" ])
      expect(body["viewer"]["isSubject"]).to be(true)
      expect(body["viewer"]["canSubmitReview"]).to be(false)
    end

    it "shows the primary manager the employee's V1 alongside their own" do
      setup = running_cycle
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template])

      login("primary@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"

      expect(body["revisions"].map { |r| r["stage"] }).to eq([ "self_appraisal" ])
      expect(body["viewer"]["level"]).to eq("primary")
      expect(body["viewer"]["canSubmitReview"]).to be(true)
    end

    it "never gives an employee a management-only comment" do
      setup = running_cycle
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template])

      login("primary@acme.test")
      post "/api/v1/appraisals/#{appraisal.id}/add_comment",
           params: { body: "Not for them", visibility: "management_only" }.to_json, headers: json_headers
      post "/api/v1/appraisals/#{appraisal.id}/add_comment",
           params: { body: "Shared with them", visibility: "employee_visible" }.to_json, headers: json_headers
      submit_review(appraisal, setup[:template])

      login("final@acme.test")
      submit_review(appraisal, setup[:template])

      login_admin
      patch "/api/v1/appraisals/#{appraisal.id}/release", params: {}.to_json, headers: json_headers
      expect(response).to have_http_status(:ok)

      login("subject@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"

      bodies = body["comments"].map { |c| c["body"] }
      expect(bodies).to eq([ "Shared with them" ])
      expect(bodies).not_to include("Not for them")
    end

    # Regression: the subject's clause used to require released_at, so an
    # employee saw NO comment at all before release — not a manager's
    # employee_visible one, and not even the comment they had just written
    # themselves. `management_only` stays the boundary; release does not.
    describe "comment visibility for the employee, before release" do
      # One appraisal mid-review, carrying one comment of each kind from the
      # primary reviewer plus one the employee wrote.
      def appraisal_with_comments
        setup = running_cycle
        appraisal = setup[:appraisal]

        login("subject@acme.test")
        submit_self(appraisal, setup[:template])

        login("primary@acme.test")
        post "/api/v1/appraisals/#{appraisal.id}/add_comment",
             params: { body: "Shared with them", visibility: "employee_visible" }.to_json, headers: json_headers
        post "/api/v1/appraisals/#{appraisal.id}/add_comment",
             params: { body: "Internal note", visibility: "management_only" }.to_json, headers: json_headers

        login("subject@acme.test")
        post "/api/v1/appraisals/#{appraisal.id}/add_comment",
             params: { body: "My own comment" }.to_json, headers: json_headers

        setup
      end

      def comment_bodies = body["comments"].map { |c| c["body"] }

      it "shows the employee a manager's employee-visible comment" do
        setup = appraisal_with_comments

        login("subject@acme.test")
        get "/api/v1/appraisals/#{setup[:appraisal].id}"

        expect(in_tenant { setup[:appraisal].reload.released_at }).to be_nil
        expect(comment_bodies).to include("Shared with them")
      end

      it "hides a management-only comment from the employee" do
        setup = appraisal_with_comments

        login("subject@acme.test")
        get "/api/v1/appraisals/#{setup[:appraisal].id}"

        expect(comment_bodies).not_to include("Internal note")
        expect(body["comments"].map { |c| c["visibility"] }.uniq).to eq([ "employee_visible" ])
      end

      it "shows the employee the comment they submitted themselves" do
        setup = appraisal_with_comments

        login("subject@acme.test")
        get "/api/v1/appraisals/#{setup[:appraisal].id}"

        expect(comment_bodies).to include("My own comment")
      end

      # The bug as reported: the comment was accepted and then vanished.
      it "returns the employee's own comment in the create response itself" do
        setup = running_cycle
        login("subject@acme.test")
        submit_self(setup[:appraisal], setup[:template])

        post "/api/v1/appraisals/#{setup[:appraisal].id}/add_comment",
             params: { body: "Straight back to me" }.to_json, headers: json_headers

        expect(response).to have_http_status(:created)
        expect(comment_bodies).to include("Straight back to me")
      end

      it "saves an employee's comment as employee_visible however they ask" do
        setup = running_cycle
        login("subject@acme.test")
        submit_self(setup[:appraisal], setup[:template])

        post "/api/v1/appraisals/#{setup[:appraisal].id}/add_comment",
             params: { body: "Not yours to hide", visibility: "management_only" }.to_json, headers: json_headers

        expect(in_tenant { setup[:appraisal].comments.last.visibility }).to eq("employee_visible")
      end

      it "still gives management-only comments to HR/Admin" do
        setup = appraisal_with_comments

        login_admin
        get "/api/v1/appraisals/#{setup[:appraisal].id}"

        expect(comment_bodies).to include("Internal note", "Shared with them", "My own comment")
      end

      it "still gives management-only comments to an assigned reviewer" do
        setup = appraisal_with_comments

        login("primary@acme.test")
        get "/api/v1/appraisals/#{setup[:appraisal].id}"

        expect(comment_bodies).to include("Internal note", "Shared with them", "My own comment")
      end

      # Being an employee somewhere does not make you an audience everywhere.
      it "shows an unrelated employee nothing, own-authored clause included" do
        setup = appraisal_with_comments
        staff(email: "stranger@acme.test", first_name: "Sam", last_name: "Stranger")

        login("stranger@acme.test")
        get "/api/v1/appraisals/#{setup[:appraisal].id}"

        expect(response).to have_http_status(:not_found)
      end
    end

    it "opens the final version to the employee only after release" do
      setup = running_cycle
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template])
      login("primary@acme.test")
      submit_review(appraisal, setup[:template])
      login("final@acme.test")
      submit_review(appraisal, setup[:template])

      login("subject@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"
      expect(body["revisions"].map { |r| r["stage"] }).to eq([ "self_appraisal" ])

      login_admin
      patch "/api/v1/appraisals/#{appraisal.id}/release", params: {}.to_json, headers: json_headers

      login("subject@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"
      expect(body["revisions"].map { |r| r["stage"] }).to match_array(%w[self_appraisal final_review])
      expect(body["viewer"]["canAcknowledge"]).to be(true)
    end

    it "keeps compensation out of everyone but an authorized holder" do
      setup = running_cycle
      appraisal = setup[:appraisal]
      login_admin
      in_tenant do
        appraisal.create_compensation_decision!(
          recommended_increment_percentage: 8, approved_increment_percentage: 8
        )
      end

      # The seeded Admin holds appraisals.manage_compensation (:all).
      get "/api/v1/appraisals/#{appraisal.id}"
      expect(body["compensation"]).to be_present

      login("primary@acme.test")
      get "/api/v1/appraisals/#{appraisal.id}"
      expect(body["compensation"]).to be_nil
    end

    it "keeps increment and promotion independent, and recommended apart from approved" do
      setup = running_cycle
      appraisal = setup[:appraisal]
      designation = in_tenant { company.designations.create!(title: "Senior Engineer") }
      login_admin

      patch "/api/v1/appraisals/#{appraisal.id}/compensation",
            params: {
              currentCompensation: 100_000,
              recommendedIncrementPercentage: 12,
              approvedIncrementPercentage: 8,
              approvedCompensation: 108_000,
              promotionRecommendation: "recommended",
              proposedDesignationId: designation.id,
              promotionReason: "Consistently operating a level up",
              managementComments: "Approved at 8% after calibration"
            }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      comp = body["compensation"]
      # What was proposed survives the approval that changed it.
      expect(comp["recommendedIncrementPercentage"].to_f).to eq(12.0)
      expect(comp["approvedIncrementPercentage"].to_f).to eq(8.0)
      # Promotion is its own decision, not a variant of the increment.
      expect(comp["promotionRecommendation"]).to eq("recommended")
      expect(comp["proposedDesignationTitle"]).to eq("Senior Engineer")
    end

    it "refuses a recommended promotion with no proposed designation" do
      setup = running_cycle
      login_admin

      patch "/api/v1/appraisals/#{setup[:appraisal].id}/compensation",
            params: { promotionRecommendation: "recommended" }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/proposed designation/i)
    end

    it "refuses an unrelated employee entirely" do
      setup = running_cycle
      staff(email: "nobody@acme.test")
      login("nobody@acme.test")

      get "/api/v1/appraisals/#{setup[:appraisal].id}"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "scoring" do
    it "weights category averages by their template weight" do
      setup = running_cycle
      login("subject@acme.test")
      # Delivery (60%) rated 5, Growth (40%) rated 4 → 5*0.6 + 4*0.4 = 4.6
      submit_self(setup[:appraisal], setup[:template], ratings: [ 5, 4 ])

      revision = in_tenant { setup[:appraisal].reload.revisions.first }
      expect(revision.calculated_score.to_f).to eq(4.6)
    end

    it "preserves the calculated score when a final reviewer overrides it" do
      setup = running_cycle
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template])
      login("primary@acme.test")
      submit_review(appraisal, setup[:template], ratings: [ 4, 4 ])
      login("final@acme.test")
      submit_review(appraisal, setup[:template], ratings: [ 4, 4 ])

      calculated = appraisal.reload.calculated_score

      patch "/api/v1/appraisals/#{appraisal.id}/override_score",
            params: { score: 3.5, reason: "Calibrated against the wider peer group" }.to_json,
            headers: json_headers

      expect(response).to have_http_status(:ok)
      expect(appraisal.reload.calculated_score).to eq(calculated)
      expect(appraisal.final_score.to_f).to eq(3.5)
      expect(body["scoreOverrides"].first["reason"]).to match(/peer group/)
    end

    it "refuses an override with no reason" do
      setup = running_cycle
      login("final@acme.test")

      patch "/api/v1/appraisals/#{setup[:appraisal].id}/override_score",
            params: { score: 3.0, reason: "" }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/reason is required/i)
    end

    it "requires evidence for ratings at the extremes" do
      setup = running_cycle
      login("subject@acme.test")

      post "/api/v1/appraisals/#{setup[:appraisal].id}/submit_self",
           params: {
             answers: question_ids(setup[:template]).map { |qid| { questionId: qid, rating: 5, comment: "" } }
           }.to_json, headers: json_headers

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/required for a rating of 5/i)
    end

    it "accepts a middling rating with no comment" do
      setup = running_cycle
      login("subject@acme.test")

      post "/api/v1/appraisals/#{setup[:appraisal].id}/submit_self",
           params: {
             answers: question_ids(setup[:template]).map { |qid| { questionId: qid, rating: 3, comment: "" } }
           }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
    end
  end

  describe "locking and authorization" do
    it "locks the employee out of their own appraisal once submitted" do
      setup = running_cycle
      login("subject@acme.test")
      submit_self(setup[:appraisal], setup[:template])

      submit_self(setup[:appraisal], setup[:template])

      expect(response).to have_http_status(:forbidden)
    end

    it "refuses a reviewer acting out of turn" do
      setup = running_cycle(secondary: true)
      login("subject@acme.test")
      submit_self(setup[:appraisal], setup[:template])

      # Primary review is outstanding; the final manager can't jump the queue.
      login("final@acme.test")
      submit_review(setup[:appraisal], setup[:template])

      expect(response).to have_http_status(:forbidden)
    end

    it "does not let a reviewer release" do
      setup = running_cycle
      appraisal = setup[:appraisal]
      login("subject@acme.test")
      submit_self(appraisal, setup[:template])
      login("primary@acme.test")
      submit_review(appraisal, setup[:template])
      login("final@acme.test")
      submit_review(appraisal, setup[:template])

      patch "/api/v1/appraisals/#{appraisal.id}/release", params: {}.to_json, headers: json_headers

      expect(response).to have_http_status(:forbidden)
    end

    it "records the acknowledgement with actor and timestamp" do
      setup = running_cycle
      appraisal = setup[:appraisal]
      login("subject@acme.test")
      submit_self(appraisal, setup[:template])
      login("primary@acme.test")
      submit_review(appraisal, setup[:template])
      login("final@acme.test")
      submit_review(appraisal, setup[:template])
      login_admin
      patch "/api/v1/appraisals/#{appraisal.id}/release", params: {}.to_json, headers: json_headers

      login("subject@acme.test")
      patch "/api/v1/appraisals/#{appraisal.id}/acknowledge",
            params: { note: "Read and understood" }.to_json, headers: json_headers

      expect(response).to have_http_status(:ok)
      appraisal.reload
      expect(appraisal.status).to eq("employee_acknowledged")
      expect(appraisal.acknowledged_at).to be_present
      expect(in_tenant { appraisal.transitions.last.actor_user.email_address }).to eq("subject@acme.test")
    end

    it "never reaches across a tenant boundary" do
      outsider = create(:company)
      foreign = ActsAsTenant.with_tenant(outsider) do
        cycle_template = outsider.appraisal_templates.create!(name: "T", status: :active)
        cycle = outsider.appraisal_cycles.create!(name: "C", appraisal_template: cycle_template)
        employee = create(:employee, company: outsider)
        outsider.appraisals.create!(appraisal_cycle: cycle, employee: employee)
      end
      login_admin

      get "/api/v1/appraisals/#{foreign.id}"

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "Excel export" do
    it "generates a workbook from the cycle's frozen template" do
      setup = running_cycle
      login("subject@acme.test")

      get "/api/v1/appraisals/#{setup[:appraisal].id}/export"

      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      expect(response.headers["Content-Disposition"]).to match(/self-appraisal-/)
      expect(response.body.bytesize).to be > 1_000
    end

    it "round-trips: the exported workbook imports cleanly into its own appraisal" do
      setup = running_cycle
      login("subject@acme.test")
      get "/api/v1/appraisals/#{setup[:appraisal].id}/export"

      file = Tempfile.new([ "wb", ".xlsx" ], binmode: true)
      file.write(response.body)
      file.rewind

      post "/api/v1/appraisals/#{setup[:appraisal].id}/import_preview",
           params: { file: Rack::Test::UploadedFile.new(file.path, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", original_filename: "wb.xlsx") }

      expect(response).to have_http_status(:ok)
      # Blank ratings, but every question row is recognised and bound to its id.
      expect(body["rows"].size).to eq(2)
      expect(body["rows"].map { |row| row["prompt"] }).to include("Met commitments")
    end

    it "refuses a workbook exported for a different employee" do
      setup = running_cycle

      # A second employee, in their own cycle on the same template.
      other = staff(email: "other@acme.test", first_name: "Other", last_name: "Person")
      in_tenant { other.assign_managers!("primary" => setup[:primary].id) }
      login_admin
      post "/api/v1/appraisal_cycles",
           params: {
             name: "Second cycle", appraisalTemplateId: setup[:template].id,
             eligibleEmployeeIds: [ other.id ]
           }.to_json, headers: json_headers
      second_cycle_id = body["id"]
      post "/api/v1/appraisal_cycles/#{second_cycle_id}/start", params: {}.to_json, headers: json_headers
      other_appraisal = in_tenant { Appraisal.find_by!(appraisal_cycle_id: second_cycle_id, employee_id: other.id) }

      # Export MY workbook…
      login("subject@acme.test")
      get "/api/v1/appraisals/#{setup[:appraisal].id}/export"
      file = Tempfile.new([ "wb", ".xlsx" ], binmode: true)
      file.write(response.body)
      file.rewind

      # …then try to file it against theirs.
      login("other@acme.test")
      post "/api/v1/appraisals/#{other_appraisal.id}/import_preview",
           params: { file: Rack::Test::UploadedFile.new(file.path, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", original_filename: "wb.xlsx") }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/different (appraisal|employee|appraisal cycle)/i)
    end
  end

  describe "Excel import" do
    def upload_csv(appraisal, content)
      file = Tempfile.new([ "self-appraisal", ".csv" ])
      file.write(content)
      file.rewind
      post "/api/v1/appraisals/#{appraisal.id}/import_preview",
           params: { file: Rack::Test::UploadedFile.new(file.path, "text/csv", original_filename: "self-appraisal.csv") }
    end

    it "parses and previews without saving anything" do
      setup = running_cycle
      ids = question_ids(setup[:template])
      login("subject@acme.test")

      expect {
        upload_csv(setup[:appraisal], <<~CSV)
          Question ID,Question,Rating,Comments
          #{ids[0]},Met commitments,5,Delivered every milestone
          #{ids[1]},Ready for more,3,
        CSV
      }.not_to change { in_tenant { AppraisalRevision.count } }

      expect(response).to have_http_status(:ok)
      expect(body["validCount"]).to eq(2)
      expect(body["invalidCount"]).to eq(0)
      expect(body["rows"].first["rating"]).to eq(5)
      # The prompt comes from the template, not from the sheet, so a reworded
      # column can't attach an answer to the wrong question.
      expect(body["rows"].first["prompt"]).to eq("Met commitments")
    end

    it "reports the same validation the model would apply, before anything is saved" do
      setup = running_cycle
      ids = question_ids(setup[:template])
      login("subject@acme.test")

      upload_csv(setup[:appraisal], <<~CSV)
        Question ID,Question,Rating,Comments
        #{ids[0]},Met commitments,5,
        #{ids[1]},Ready for more,9,Too high
        999999,Not ours,3,
      CSV

      expect(response).to have_http_status(:ok)
      messages = body["rows"].flat_map { |row| row["errors"] }
      expect(messages).to include(a_string_matching(/rating of 5 needs evidence/i))
      expect(messages).to include(a_string_matching(/between 1 and 5/i))
      expect(messages).to include(a_string_matching(/isn't part of this appraisal's template/i))
      expect(body["invalidCount"]).to eq(3)
    end

    it "refuses a file that isn't a spreadsheet" do
      setup = running_cycle
      login("subject@acme.test")
      file = Tempfile.new([ "notes", ".txt" ])
      file.write("hello")
      file.rewind

      post "/api/v1/appraisals/#{setup[:appraisal].id}/import_preview",
           params: { file: Rack::Test::UploadedFile.new(file.path, "text/plain", original_filename: "notes.txt") }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["errors"].first["message"]).to match(/\.xlsx.*\.csv/i)
    end

    it "is closed to anyone but the employee themselves" do
      setup = running_cycle
      login("primary@acme.test")

      upload_csv(setup[:appraisal], "Question ID,Rating\n1,3\n")

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "calibration dashboard" do
    it "puts self, manager, weighted and final ratings side by side" do
      setup = running_cycle
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template], ratings: [ 5, 5 ])
      login("primary@acme.test")
      submit_review(appraisal, setup[:template], ratings: [ 3, 3 ])

      login_admin
      get "/api/v1/appraisal_cycles/#{setup[:cycle_id]}/calibration"

      expect(response).to have_http_status(:ok)
      row = body["rows"].first
      expect(row["employeeName"]).to eq("Sofia Subject")
      expect(row["selfRating"]).to eq(5.0)
      expect(row["managerRating"]).to eq(3.0)
      expect(row["weightedScore"]).to eq(3.0)
      # A two-point disagreement is flagged for a human to look at.
      expect(row["gap"]).to eq(2.0)
      expect(row["flagged"]).to be(true)
    end

    it "does not flag a modest disagreement" do
      setup = running_cycle
      appraisal = setup[:appraisal]

      login("subject@acme.test")
      submit_self(appraisal, setup[:template], ratings: [ 4, 4 ])
      login("primary@acme.test")
      submit_review(appraisal, setup[:template], ratings: [ 3, 3 ])

      login_admin
      get "/api/v1/appraisal_cycles/#{setup[:cycle_id]}/calibration"

      expect(body["rows"].first["flagged"]).to be(false)
      expect(body["summary"]["flagged"]).to eq(0)
    end

    it "is closed to a reviewer without company-wide appraisal access" do
      setup = running_cycle
      login("primary@acme.test")

      get "/api/v1/appraisal_cycles/#{setup[:cycle_id]}/calibration"

      # 403 on the cycle itself, since appraisal_cycles.view is HR/Admin only.
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "list scopes" do
    it "answers 'what is waiting on me' with only the stage I own" do
      setup = running_cycle
      login("subject@acme.test")
      submit_self(setup[:appraisal], setup[:template])

      login("primary@acme.test")
      get "/api/v1/appraisals?scope=pending"
      expect(body.map { |a| a["id"] }).to eq([ setup[:appraisal].id ])

      # The final manager is in the chain but the ball isn't with them yet.
      login("final@acme.test")
      get "/api/v1/appraisals?scope=pending"
      expect(body).to be_empty
    end

    it "gives an employee their own appraisal under scope=mine" do
      setup = running_cycle
      login("subject@acme.test")

      get "/api/v1/appraisals?scope=mine"

      expect(body.map { |a| a["id"] }).to eq([ setup[:appraisal].id ])
    end
  end
end
