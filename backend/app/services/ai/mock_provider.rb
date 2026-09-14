module Ai
  class MockProvider < Provider
    attr_reader :last_metadata

    def initialize
      @last_metadata = {
        provider: "mock",
        model: "mock-model-v1",
        duration_ms: 120,
        input_tokens: 450,
        output_tokens: 380,
        processed_at: Time.current.iso8601
      }
    end

    def complete(prompt:, system: nil, max_tokens: 4096, temperature: 0.1)
      if prompt =~ /candidate_matcher|match_score|job description/i
        mock_matching_response(prompt)
      elsif prompt =~ /ats_score|ATS \(Applicant Tracking System\)|ATS resume quality/i
        # Matched before the resume-parsing fallback below: without its own
        # branch an ATS prompt fell through to mock_resume_parsing_response,
        # so Ai::AtsScorer got a parsed-profile payload with no "ats_score"
        # key, read nil, and every resume scored 0 against the mock provider.
        mock_ats_response(prompt)
      elsif prompt =~ /search_parser|natural[- ]language|user search query|search interpretation/i
        mock_search_response(prompt)
      elsif prompt =~ /dashboard_insights|recruitment analytics/i
        mock_insights_response(prompt)
      else
        mock_resume_parsing_response(prompt)
      end
    end

    private

    def mock_resume_parsing_response(prompt)
      # Scrape the resume itself, never the instruction template that
      # precedes it: the template's own examples (field names like "Computer
      # Science") would otherwise be read as the candidate's name, making
      # every mocked result depend on the current prompt's wording.
      document = prompt.split("DOCUMENT TEXT TO ANALYZE:").last.to_s
      email = document[/[\w.+-]+@[\w-]+\.[\w.-]+/] || "candidate@example.com"
      name = document[/([A-Z][a-z]+ [A-Z][a-z]+)/] || "Alex Rivera"

      {
        candidate: {
          full_name: { value: name, confidence: 0.95, provenance: "explicit", source: "header" },
          email: { value: email, confidence: 0.98, provenance: "explicit", source: "contact" },
          phone: { value: "+1 555-0199", confidence: 0.90, provenance: "explicit", source: "contact" },
          city: { value: "Bangalore", confidence: 0.92, provenance: "explicit", source: "location" },
          state: { value: "Karnataka", confidence: 0.90, provenance: "explicit", source: "location" },
          country: { value: "India", confidence: 0.95, provenance: "explicit", source: "location" },
          current_role: { value: "Senior Software Engineer", confidence: 0.90, provenance: "explicit", source: "experience" },
          highest_qualification: { value: "B.Tech Computer Science", confidence: 0.95, provenance: "explicit", source: "education" },
          experience_years: { value: 4.5, confidence: 0.90, provenance: "explicit", source: "experience_calculation" },
          notice_period: { value: "30 days", confidence: 0.85, provenance: "explicit", source: "summary" },
          skills: [
            { name: "Ruby", category: "programming_language", confidence: 0.95, provenance: "explicit" },
            { name: "Ruby on Rails", category: "framework", confidence: 0.95, provenance: "explicit" },
            { name: "PostgreSQL", category: "database", confidence: 0.90, provenance: "explicit" },
            { name: "React", category: "framework", confidence: 0.88, provenance: "explicit" },
            { name: "TypeScript", category: "programming_language", confidence: 0.85, provenance: "explicit" },
            { name: "Docker", category: "tool", confidence: 0.82, provenance: "explicit" }
          ],
          qualifications: [
            { degree: "B.Tech Computer Science", field_of_study: "Computer Science", institution: "National Institute of Technology", year_completed: 2020, confidence: 0.95, provenance: "explicit" }
          ],
          experiences: [
            { job_title: "Senior Software Engineer", company_name: "Tech Solutions Inc.", start_date: "2022-01-01", end_date: nil, is_current: true, duration_months: 28, description: "Backend architecture and scalable APIs", confidence: 0.95 },
            { job_title: "Software Engineer", company_name: "Cloud Innovations", start_date: "2020-07-01", end_date: "2021-12-31", is_current: false, duration_months: 18, description: "Full stack web development", confidence: 0.90 }
          ],
          certifications: [
            { name: "AWS Certified Developer", issuing_organization: "Amazon Web Services", issue_date: "2023-04-15" }
          ]
        },
        ai_summary: "Experienced full-stack engineer with 4.5 years building robust web applications in Rails and React with solid database fundamentals."
      }.to_json
    end

    # Varies with the document so a list of resumes doesn't render one
    # identical score down the whole column, while staying deterministic for
    # the same input.
    def mock_ats_response(prompt)
      document = prompt.split("RESUME TEXT:").last.to_s
      score = 55 + (Digest::SHA256.hexdigest(document).to_i(16) % 41) # 55..95

      {
        ats_score: score,
        summary: "Mock ATS score — no live AI provider is configured."
      }.to_json
    end

    def mock_matching_response(prompt)
      {
        match_score: 87,
        skills_score: 90,
        experience_score: 85,
        qualification_score: 90,
        strong_matches: [
          "B.Tech Computer Science meets degree requirements",
          "4.5+ years of software development experience",
          "Deep expertise in Ruby on Rails and PostgreSQL",
          "Experience with Docker and modern cloud deployments"
        ],
        potential_gaps: [
          "Kubernetes production management experience not explicitly detailed"
        ],
        matching_skills: ["Ruby", "Ruby on Rails", "PostgreSQL", "React", "Docker"],
        missing_skills: ["Kubernetes", "AWS Lambda"],
        ai_explanation: "Strong candidate matching 87% of role requirements with solid backend foundation and modern stack experience."
      }.to_json
    end

    def mock_search_response(prompt)
      user_query = prompt.split("USER SEARCH QUERY:").last || prompt
      {
        city: user_query[/bangalore|mumbai|delhi|london|new york|san francisco/i]&.capitalize,
        skills: user_query.scan(/java|python|ruby|react|docker|sql|rails/i).map(&:capitalize).uniq,
        minimum_experience_years: user_query[/(\d+)\+?\s*(?:years?|yrs?)/i, 1]&.to_f,
        qualifications: user_query.scan(/b\.?tech|m\.?tech|bca|mca|bachelor|master/i).map(&:upcase).uniq,
        query_interpretation: "Filtered candidates matching extracted skills and experience constraints."
      }.to_json
    end

    def mock_insights_response(prompt)
      {
        executive_summary: "The recruitment pipeline shows strong growth in engineering and product candidates. Processing turnaround is under 2 hours.",
        top_strengths: [
          "Healthy candidate distribution across Tier-1 tech hubs",
          "High average experience match (3.5+ years) across technical roles",
          "Zero processing backlog on incoming Zoho Mail attachments"
        ],
        actionable_recommendations: [
          "Review 4 candidates currently pending initial human review",
          "Prioritize scheduling screening interviews for shortlisted candidates"
        ]
      }.to_json
    end
  end
end
