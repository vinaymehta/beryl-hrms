FactoryBot.define do
  factory :candidate do
    company
    full_name { "Jane Candidate" }
    email { "jane.candidate@test.com" }
    city { "Bangalore" }
    current_role { "Software Engineer" }
    highest_qualification { "B.Tech" }
    experience_years { 4.0 }
    status { :applied }
    source { "manual_upload" }
    duplicate_status { :unique_record }
  end

  factory :candidate_resume do
    company
    file_name { "resume.pdf" }
    content_type { "application/pdf" }
    file_size { 12040 }
    processing_status { :pending }
    source { "manual_upload" }
  end

  factory :job do
    company
    title { "Full Stack Engineer" }
    min_experience { 3.0 }
    required_skills { [ "React", "Ruby on Rails" ] }
    required_qualifications { [ "B.Tech", "MCA" ] }
    description { "Looking for experienced engineer" }
    status { :open }
  end

  factory :candidate_job_match do
    company
    candidate
    job
    match_score { 85 }
    skills_score { 90 }
    experience_score { 80 }
    qualification_score { 85 }
    strong_matches { [ "4+ years experience", "Strong React & Rails skills" ] }
    potential_gaps { [] }
    ai_explanation { "Strong candidate with relevant experience." }
    status { :suggested }
  end
end
