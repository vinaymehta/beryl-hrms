class ResumeExtractionJob < ApplicationJob
  queue_as :default

  RETRYABLE_ERRORS = [ Ai::RateLimitedError, Faraday::TimeoutError, Faraday::ConnectionFailed, Net::OpenTimeout ].freeze

  retry_on(*RETRYABLE_ERRORS, wait: :polynomially_longer, attempts: 3) do |job, error|
    job.send(:handle_exhausted_retries, error)
  end

  # Stage 2 of the pipeline: AI structured extraction + candidate persistence.
  # Assumes ResumeProcessingJob already downloaded the file and populated
  # raw_text — a bad/expired Zoho token never gets an AI-retry budget wasted
  # on it, and a Claude rate limit never re-downloads the attachment.
  def perform(candidate_resume_id)
    @candidate_resume_id = candidate_resume_id
    resume = CandidateResume.unscoped.find_by(id: candidate_resume_id)
    return unless resume

    ActsAsTenant.with_tenant(resume.company) do
      extract_and_persist(resume)
    end
  end

  private

  def extract_and_persist(resume)
    if resume.raw_text.blank?
      resume.update!(processing_status: :failed, error_message: "No extracted text available for AI analysis.")
      return
    end

    parsed = Ai::ResumeParser.parse(resume.raw_text, resume: resume)

    unless parsed[:is_likely_resume]
      resume.update!(
        processing_status: :not_a_resume,
        extracted_data: parsed[:candidate],
        ai_metadata: parsed[:ai_metadata]
      )
      return
    end

    candidate = resolve_candidate(resume, parsed[:candidate])
    resume.update!(candidate: candidate)

    sync_candidate_profile(candidate, parsed[:candidate], parsed[:ai_summary])

    # Deterministic eligibility decides shortlist/needs-review — the AI ATS
    # score is supplementary/display-only and never influences this. Only
    # ever auto-transitions a candidate still sitting at the needs_review
    # default; once HR (or a prior auto-shortlist) has moved them anywhere
    # else, later resumes update the displayed numbers but never silently
    # change status again.
    eligibility = Recruitment::EligibilityEvaluator.call(candidate)
    candidate.update!(status: eligibility.status) if candidate.needs_review?

    ats_score = Ai::AtsScorer.score(raw_text: resume.raw_text, extracted_candidate: parsed[:candidate], resume: resume)

    resume.update!(
      processing_status: :completed,
      # ai_summary folded into this resume's own snapshot (not just synced
      # onto the candidate, which only reflects whichever resume is current)
      # so the AI Summary panel is accurate even when viewing an older resume.
      extracted_data: parsed[:candidate].merge(ai_summary: parsed[:ai_summary]),
      provenance_data: parsed[:provenance],
      ai_metadata: parsed[:ai_metadata],
      processed_at: Time.current,
      ats_score: ats_score,
      criteria_match_percentage: eligibility.match_percentage,
      eligibility_breakdown: {
        qualification: eligibility.qualification,
        marks: eligibility.marks,
        graduation_year: eligibility.graduation_year,
        backlog: eligibility.backlog
      }
    )
  rescue *RETRYABLE_ERRORS => e
    Rails.logger.warn("ResumeExtractionJob transient failure for CandidateResume##{resume.id}, will retry: #{e.message}")
    raise
  rescue => e
    Rails.logger.error("ResumeExtractionJob failed for CandidateResume##{resume.id}: #{e.message}\n#{e.backtrace.take(5).join("\n")}")
    resume.update!(
      processing_status: :failed,
      error_message: e.message,
      retries_count: resume.retries_count + 1
    )
  end

  def handle_exhausted_retries(error)
    resume = CandidateResume.unscoped.find_by(id: @candidate_resume_id)
    return unless resume

    ActsAsTenant.with_tenant(resume.company) do
      Rails.logger.error("ResumeExtractionJob exhausted retries for CandidateResume##{resume.id}: #{error.message}")
      resume.update!(
        processing_status: :failed,
        error_message: "AI service unavailable after retries: #{error.message}",
        retries_count: resume.retries_count + 1
      )
    end
  end

  # Identity resolution, in order of trust:
  #  1. Email or phone match -> the same real person, confidently. Attach this
  #     resume to that existing candidate and make it the current one; no
  #     human review needed.
  #  2. Only a normalized-name match (common names collide) -> too weak to
  #     auto-merge. A new candidate record is created instead, flagged
  #     potential_duplicate so HR can manually confirm/merge.
  #  3. No signal matches anything -> brand new, unique candidate.
  # Resumes are never deleted or reassigned automatically here — exact
  # file-duplicate detection already short-circuited in ResumeProcessingJob
  # before this job ever runs.
  def resolve_candidate(resume, data)
    email = data[:email].to_s.strip.downcase.presence
    phone = data[:phone].to_s.strip.presence
    normalized_name = normalize_name(data[:full_name])
    full_name = data[:full_name].to_s.strip.presence || "Candidate #{Time.current.strftime('%Y%m%d%H%M')}"

    candidate = nil
    candidate = resume.company.candidates.where("LOWER(email) = ?", email).first if email
    candidate ||= resume.company.candidates.where(phone: phone).first if phone

    if candidate
      mark_resume_current!(resume, candidate)
      return candidate
    end

    weak_match = normalized_name.present? && resume.company.candidates.any? { |c| normalize_name(c.full_name) == normalized_name }

    candidate = resume.company.candidates.create!(
      full_name: full_name,
      first_name: data[:first_name],
      last_name: data[:last_name],
      email: email,
      phone: phone,
      status: :needs_review, # Human review required
      source: resume.source_email_id.present? ? "zoho_mail" : "manual_upload",
      duplicate_status: weak_match ? :potential_duplicate : :unique_record
    )
    mark_resume_current!(resume, candidate)
    candidate
  end

  def normalize_name(name)
    name.to_s.strip.downcase.gsub(/\s+/, " ").presence
  end

  # Only one resume is ever "current" per candidate — the most recently
  # processed one. Older resumes for the same candidate are kept (never
  # deleted) but stop driving the profile once a newer one is attached.
  def mark_resume_current!(resume, candidate)
    candidate.candidate_resumes.where.not(id: resume.id).update_all(is_current: false)
    resume.is_current = true
  end

  # This resume has just become the candidate's current one (mark_resume_current!
  # already ran) — its data is now authoritative for the profile. Scalar fields
  # are overwritten outright (identity fields fall back to the prior value
  # instead of blanking out if this resume's extraction missed them); skills/
  # qualifications/experiences/certifications are replaced rather than
  # accumulated, so a candidate's profile always reflects their current resume
  # instead of a lifetime union of everything ever submitted.
  def sync_candidate_profile(candidate, data, summary)
    candidate.update!(
      full_name: data[:full_name].presence || candidate.full_name,
      first_name: data[:first_name].presence || candidate.first_name,
      last_name: data[:last_name].presence || candidate.last_name,
      email: data[:email].presence || candidate.email,
      phone: data[:phone].presence || candidate.phone,
      city: data[:city],
      state: data[:state],
      country: data[:country],
      current_location: data[:current_location],
      preferred_location: data[:preferred_location],
      current_role: data[:current_role],
      highest_qualification: data[:highest_qualification],
      experience_years: data[:experience_years] || 0,
      notice_period: data[:notice_period],
      industry: data[:industry],
      languages: Array(data[:languages]),
      # Tri-state eligibility facts — pass through as-is (nil/true/false),
      # never coerced, so "confirmed false" and "not extracted" stay distinct
      # all the way to Recruitment::EligibilityEvaluator.
      academic_percentage: data[:academic_percentage],
      academic_cgpa: data[:academic_cgpa],
      graduation_year: data[:graduation_year],
      active_backlogs: data[:active_backlogs],
      notes: summary.presence || candidate.notes
    )

    candidate.candidate_skills.destroy_all
    candidate.candidate_qualifications.destroy_all
    candidate.candidate_experiences.destroy_all
    candidate.candidate_certifications.destroy_all

    Array(data[:skills]).each do |s|
      name = s["name"] || s[:name]
      next if name.blank?
      category = s["category"] || s[:category]
      category = nil unless CandidateSkill::CATEGORIES.include?(category.to_s)
      candidate.candidate_skills.find_or_create_by!(name: name.strip) do |skill|
        skill.category = category
        skill.confidence = (s["confidence"] || s[:confidence] || 1.0).to_f
        skill.provenance = s["provenance"] || s[:provenance] || "explicit"
        skill.company = candidate.company
      end
    end

    Array(data[:qualifications]).each do |q|
      degree = q["degree"] || q[:degree]
      next if degree.blank?
      candidate.candidate_qualifications.find_or_create_by!(degree: degree.strip) do |qual|
        qual.field_of_study = q["field_of_study"] || q[:field_of_study]
        qual.institution = q["institution"] || q[:institution]
        qual.year_completed = (q["year_completed"] || q[:year_completed])&.to_i
        qual.confidence = (q["confidence"] || q[:confidence] || 1.0).to_f
        qual.provenance = q["provenance"] || q[:provenance] || "explicit"
        qual.company = candidate.company
      end
    end

    Array(data[:experiences]).each do |e|
      title = e["job_title"] || e[:job_title]
      comp = e["company_name"] || e[:company_name]
      next if title.blank? || comp.blank?
      candidate.candidate_experiences.find_or_create_by!(job_title: title.strip, company_name: comp.strip) do |exp|
        exp.start_date = Date.parse(e["start_date"].to_s) rescue nil
        exp.end_date = Date.parse(e["end_date"].to_s) rescue nil
        exp.is_current = e["is_current"] || e[:is_current] || false
        exp.duration_months = (e["duration_months"] || e[:duration_months])&.to_i
        exp.description = e["description"] || e[:description]
        exp.confidence = (e["confidence"] || e[:confidence] || 1.0).to_f
        exp.provenance = e["provenance"] || e[:provenance] || "explicit"
        exp.company = candidate.company
      end
    end

    Array(data[:certifications]).each do |c|
      name = c["name"] || c[:name]
      next if name.blank?
      candidate.candidate_certifications.find_or_create_by!(name: name.strip) do |cert|
        cert.issuing_organization = c["issuing_organization"] || c[:issuing_organization]
        cert.issue_date = Date.parse(c["issue_date"].to_s) rescue nil
        cert.confidence = (c["confidence"] || c[:confidence] || 1.0).to_f
        cert.provenance = c["provenance"] || c[:provenance] || "explicit"
        cert.company = candidate.company
      end
    end
  end
end
