require "rails_helper"

# The four criteria are the whole product decision — a wrong verdict here
# silently rejects a real candidate — so every rule is pinned down,
# including the ambiguous resume shapes that motivated them.
RSpec.describe Recruitment::EligibilityEvaluator do
  let(:company) { create(:company) }
  let(:this_year) { Date.current.year }

  # Builds a candidate that passes everything, so each example can knock out
  # exactly one criterion and prove that criterion is what moved the result.
  # :unset means "the happy-path default"; an explicit nil really means nil,
  # which matters because the fallback to candidate.graduation_year is
  # itself under test.
  def candidate_for(qualifications: [ { degree: "MCA", field_of_study: nil, year_completed: nil } ],
                    highest_qualification: "MCA",
                    academic_percentage: 75,
                    academic_cgpa: nil,
                    graduation_year: :unset,
                    active_backlogs: nil)
    ActsAsTenant.with_tenant(company) do
      candidate = create(
        :candidate,
        company: company,
        highest_qualification: highest_qualification,
        academic_percentage: academic_percentage,
        academic_cgpa: academic_cgpa,
        graduation_year: graduation_year == :unset ? this_year : graduation_year,
        active_backlogs: active_backlogs
      )
      qualifications.each do |q|
        candidate.candidate_qualifications.create!(
          company: company,
          degree: q[:degree],
          field_of_study: q[:field_of_study],
          year_completed: q.key?(:year_completed) ? q[:year_completed] : this_year
        )
      end
      candidate
    end
  end

  def evaluate(**overrides)
    ActsAsTenant.with_tenant(company) { described_class.call(candidate_for(**overrides)) }
  end

  describe "the overall verdict" do
    it "shortlists at 100% only when all four criteria are confirmed" do
      result = evaluate

      expect(result).to have_attributes(
        qualification: true, marks: true, graduation_year: true, backlog: true,
        match_percentage: 100, status: :shortlisted
      )
    end

    it "rejects when a single criterion fails, and scores the confirmed ones" do
      result = evaluate(academic_percentage: 45)

      expect(result.marks).to be(false)
      expect(result.match_percentage).to eq(75)
      expect(result.status).to eq(:rejected)
    end

    it "rejects on missing data just as it does on a confirmed failure" do
      result = evaluate(qualifications: [], highest_qualification: nil)

      expect(result.qualification).to be_nil
      expect(result.status).to eq(:rejected)
    end
  end

  describe "qualification" do
    it "accepts computer-applications degrees on their own" do
      [ "BCA", "MCA", "Master of Computer Applications (MCA)", "B.C.A" ].each do |degree|
        expect(evaluate(qualifications: [ { degree: degree } ]).qualification).to be(true), "expected #{degree} to be accepted"
      end
    end

    it "accepts B.Tech/M.Tech only when paired with an accepted field" do
      accepted = [
        [ "B.Tech", "CSE" ], [ "M.Tech", "CSE" ],
        [ "B.Tech", "Computer Science" ], [ "B.Tech", "CS" ],
        [ "B.Tech", "Computer Engineering" ], [ "M.Tech", "Computer Engineering" ],
        [ "B.Tech", "IT" ], [ "M.Tech", "Information Technology" ],
        [ "Bachelor of Technology", "Computer Science" ]
      ]
      accepted.each do |degree, field|
        result = evaluate(qualifications: [ { degree: degree, field_of_study: field } ])
        expect(result.qualification).to be(true), "expected #{degree} #{field} to be accepted"
      end
    end

    it "rejects B.Tech/M.Tech when the field is not ours" do
      [ [ "M.Tech", "Cybersecurity" ], [ "B.Tech", "Mechanical Engineering" ],
        [ "B.Tech", "Electronics and Communication" ], [ "M.Tech", "Data Science" ] ].each do |degree, field|
        result = evaluate(qualifications: [ { degree: degree, field_of_study: field } ])
        expect(result.qualification).to be(false), "expected #{degree} #{field} to be rejected"
      end
    end

    it "rejects B.Tech/M.Tech with no field stated at all" do
      expect(evaluate(qualifications: [ { degree: "B.Tech", field_of_study: nil } ]).qualification).to be(false)
      expect(evaluate(qualifications: [ { degree: "M.Tech", field_of_study: nil } ]).qualification).to be(false)
    end

    # B.E./M.E./B.Sc/M.Sc are outside the accepted set entirely — an
    # accepted field does NOT rescue them, which is the whole point of
    # naming the four degrees rather than the fields alone.
    it "rejects degree families outside the accepted four, even in an accepted field" do
      [ [ "B.E.", "Computer Engineering" ], [ "BE", "CSE" ], [ "M.E.", "Computer Science" ],
        [ "B.Sc", "Information Technology" ], [ "M.Sc", "Computer Science" ],
        [ "Bachelor of Engineering", "Computer Science" ], [ "Bachelor of Science", "IT" ] ].each do |degree, field|
        result = evaluate(qualifications: [ { degree: degree, field_of_study: field } ])
        expect(result.qualification).to be(false), "expected #{degree} #{field} to be rejected"
      end
    end

    it "rejects unrelated degrees outright" do
      [ "MBA", "BBA", "B.Com", "Bachelor of Arts", "Diploma in Computer Science" ].each do |degree|
        expect(evaluate(qualifications: [ { degree: degree } ]).qualification).to be(false), "expected #{degree} to be rejected"
      end
    end

    it "reads the field from the degree string when it isn't a separate column" do
      result = evaluate(qualifications: [ { degree: "B.Tech Computer Science", field_of_study: nil } ])

      expect(result.qualification).to be(true)
    end

    it "passes when an accepted qualification is held alongside an unrelated later one" do
      result = evaluate(
        qualifications: [
          { degree: "B.Tech", field_of_study: "Computer Science", year_completed: this_year - 4 },
          { degree: "MBA", field_of_study: nil, year_completed: this_year }
        ]
      )

      expect(result.qualification).to be(true)
    end

    # Qualification text is whatever the AI scraped off the page, so stray
    # prose lands here regularly. Nothing in it may read as a degree, and a
    # lowercase "it"/"cs" is an English word, not a field of study.
    it "never reads prose as a qualification" do
      [ "I would be happy to relocate", "Contact me for details",
        "Skilled in it support and cs fundamentals", "Available to join immediately" ].each do |text|
        expect(evaluate(qualifications: [ { degree: text } ]).qualification).to be(false), "expected #{text.inspect} to be rejected"
      end
    end

    it "falls back to the flattened qualification when none were captured structurally" do
      result = evaluate(qualifications: [], highest_qualification: "B.Tech Information Technology")

      expect(result.qualification).to be(true)
    end

    it "is unknown — not a failure — when no qualification data exists at all" do
      result = evaluate(qualifications: [], highest_qualification: nil)

      expect(result.qualification).to be_nil
    end
  end

  describe "graduation year" do
    it "accepts the current and previous year, and rejects anything older" do
      expect(evaluate(qualifications: [ { degree: "MCA", year_completed: this_year } ]).graduation_year).to be(true)
      expect(evaluate(qualifications: [ { degree: "MCA", year_completed: this_year - 1 } ]).graduation_year).to be(true)
      expect(evaluate(qualifications: [ { degree: "MCA", year_completed: this_year - 2 } ]).graduation_year).to be(false)
    end

    it "reads the year off the latest accepted qualification, not the newest unrelated one" do
      result = evaluate(
        qualifications: [
          { degree: "B.Tech", field_of_study: "Computer Science", year_completed: this_year - 5 },
          { degree: "MBA", field_of_study: nil, year_completed: this_year }
        ]
      )

      # The MBA is newer, but the B.Tech is the qualification that counts —
      # so its year is the one judged, and it's too old.
      expect(result.qualification).to be(true)
      expect(result.graduation_year).to be(false)
    end

    it "uses the latest of several accepted qualifications" do
      result = evaluate(
        qualifications: [
          { degree: "BCA", year_completed: this_year - 3 },
          { degree: "MCA", year_completed: this_year }
        ]
      )

      expect(result.graduation_year).to be(true)
    end

    it "treats an ongoing degree's stated end year as its graduation year" do
      result = evaluate(qualifications: [ { degree: "MCA", year_completed: this_year } ], graduation_year: this_year)

      expect(result.graduation_year).to be(true)
    end

    it "prefers a dated qualification over an undated one" do
      result = evaluate(
        qualifications: [
          { degree: "MCA", year_completed: nil },
          { degree: "BCA", year_completed: this_year }
        ]
      )

      expect(result.graduation_year).to be(true)
    end

    it "falls back to the candidate's own graduation year when the qualification has none" do
      result = evaluate(qualifications: [ { degree: "MCA", year_completed: nil } ], graduation_year: this_year - 1)

      expect(result.graduation_year).to be(true)
    end

    it "is unknown when no year is recorded anywhere" do
      result = evaluate(qualifications: [ { degree: "MCA", year_completed: nil } ], graduation_year: nil)

      expect(result.graduation_year).to be_nil
    end

    it "treats an implausible year as unreadable rather than as a failure" do
      result = evaluate(qualifications: [ { degree: "MCA", year_completed: 12 } ], graduation_year: nil)

      expect(result.graduation_year).to be_nil
    end
  end

  describe "marks" do
    it "passes above 60% and fails at or below it" do
      expect(evaluate(academic_percentage: 60.01).marks).to be(true)
      expect(evaluate(academic_percentage: 60).marks).to be(false)
      expect(evaluate(academic_percentage: 59.9).marks).to be(false)
    end

    it "converts a CGPA to a percentage instead of treating it as missing" do
      # 7.59 * 9.5 = 72.1%
      expect(evaluate(academic_percentage: nil, academic_cgpa: 7.59).marks).to be(true)
      # 6.0 * 9.5 = 57%
      expect(evaluate(academic_percentage: nil, academic_cgpa: 6.0).marks).to be(false)
    end

    it "reads a CGPA that was written into the percentage field" do
      result = evaluate(academic_percentage: 7.59, academic_cgpa: nil)

      expect(result.marks).to be(true)
    end

    it "reads a percentage that was written into the CGPA field" do
      expect(evaluate(academic_percentage: nil, academic_cgpa: 72.6).marks).to be(true)
      expect(evaluate(academic_percentage: nil, academic_cgpa: 45.0).marks).to be(false)
    end

    it "prefers an explicit percentage over a CGPA when both are present" do
      # 40% fails even though the CGPA alone (9.0 -> 85.5%) would have passed.
      expect(evaluate(academic_percentage: 40, academic_cgpa: 9.0).marks).to be(false)
    end

    it "treats a perfect 10 CGPA as a CGPA, not as 10%" do
      expect(evaluate(academic_percentage: nil, academic_cgpa: 10).marks).to be(true)
    end

    it "is unknown when no marks were captured" do
      expect(evaluate(academic_percentage: nil, academic_cgpa: nil).marks).to be_nil
    end

    it "treats impossible values as unreadable rather than as a failure" do
      expect(evaluate(academic_percentage: 150, academic_cgpa: nil).marks).to be_nil
      expect(evaluate(academic_percentage: 0, academic_cgpa: nil).marks).to be_nil
    end
  end

  describe "backlogs" do
    it "fails only when the resume explicitly states active backlogs" do
      expect(evaluate(active_backlogs: true).backlog).to be(false)
    end

    it "passes when the resume explicitly states there are none" do
      expect(evaluate(active_backlogs: false).backlog).to be(true)
    end

    it "passes when backlogs are not mentioned at all" do
      # Resumes essentially never say "no backlogs"; treating silence as
      # unknown would fail nearly every genuine candidate.
      expect(evaluate(active_backlogs: nil).backlog).to be(true)
    end
  end

  describe "the resume shapes that motivated these rules" do
    it "shortlists an MCA graduating this year with a CGPA and no backlog mention" do
      result = evaluate(
        qualifications: [
          { degree: "Bachelor of Computer Applications", field_of_study: "Data Science", year_completed: this_year - 3 },
          { degree: "Master of Computer Applications (MCA)", field_of_study: nil, year_completed: this_year }
        ],
        highest_qualification: "Master of Computer Applications (MCA)",
        academic_percentage: nil,
        academic_cgpa: 7.59,
        active_backlogs: nil
      )

      expect(result).to have_attributes(
        qualification: true, marks: true, graduation_year: true, backlog: true,
        match_percentage: 100, status: :shortlisted
      )
    end

    it "rejects a senior professional whose resume carries no education section" do
      result = evaluate(
        qualifications: [], highest_qualification: nil,
        academic_percentage: nil, academic_cgpa: nil, graduation_year: nil, active_backlogs: nil
      )

      expect(result).to have_attributes(qualification: nil, marks: nil, graduation_year: nil, status: :rejected)
      expect(result.match_percentage).to eq(25) # backlog alone is confirmed
    end
  end
end
