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

    # Not a resume: dropped, not kept — only a skip-note of the attachment
    # stays, so the scan never picks it up again (Recruitment::DropNonResume).
    unless parsed[:is_likely_resume]
      Recruitment::DropNonResume.call(resume)
      return
    end

    data = with_application_details(resume, parsed[:candidate])
    candidate = resolve_candidate(resume, data)
    resume.update!(candidate: candidate)
    link_application(resume, candidate)

    sync_candidate_profile(candidate, data, parsed[:ai_summary])

    # Deterministic eligibility decides shortlist/reject — the AI ATS score
    # is supplementary/display-only and never influences this. The evaluator
    # always has the final say: every time a resume finishes processing, the
    # candidate's status is (re)set from that resume's own 4-criteria result,
    # even if a previous resume already earned them a different status (e.g.
    # a stronger follow-up resume can move a previously-rejected candidate to
    # Shortlisted, and vice versa).
    eligibility = Recruitment::EligibilityEvaluator.call(candidate)
    # ...but only while the candidate is still at the eligibility stage. Once
    # a human has scheduled an interview, reprocessing a resume must not drag
    # them back to shortlisted/rejected and silently discard the interview
    # they were booked for — an auto-scan picking up a re-sent resume would
    # otherwise undo the whole interview workflow behind the admin's back.
    candidate.update!(status: eligibility.status) unless candidate.in_interview_workflow?

    ats_score = Ai::AtsScorer.score(raw_text: resume.raw_text, extracted_candidate: data, resume: resume)

    resume.update!(
      processing_status: :completed,
      # ai_summary folded into this resume's own snapshot (not just synced
      # onto the candidate, which only reflects whichever resume is current)
      # so the AI Summary panel is accurate even when viewing an older resume.
      extracted_data: data.merge(ai_summary: parsed[:ai_summary]),
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
  #  1. Email or phone match AND the same name -> the same real person,
  #     confidently. Attach this resume to that existing candidate and make it
  #     the current one; no human review needed.
  #  2. The resume is already attached to someone -> keep that link. A
  #     reprocess is not new evidence about who sent it.
  #  3. Email or phone match but a DIFFERENT name (a shared family inbox, a
  #     placement agency's phone, a recycled number) -> not safe to merge:
  #     merging would overwrite the other person's profile with this resume.
  #     A new candidate record is created instead, flagged potential_duplicate
  #     so HR can confirm or dismiss it.
  #  4. Only a normalized-name match (common names collide) -> too weak to
  #     auto-merge either; also a new candidate flagged potential_duplicate.
  #  5. No signal matches anything -> brand new, unique candidate.
  # Resumes are never deleted or reassigned automatically here — exact
  # file-duplicate detection already short-circuited in ResumeProcessingJob
  # before this job ever runs.
  def resolve_candidate(resume, data)
    email = data[:email].to_s.strip.downcase.presence
    phone = data[:phone].to_s.strip.presence
    normalized_name = normalize_name(data[:full_name])
    full_name = data[:full_name].to_s.strip.presence || "Candidate #{Time.current.strftime('%Y%m%d%H%M')}"

    contact_matches = []
    contact_matches += resume.company.candidates.where("LOWER(email) = ?", email).to_a if email
    contact_matches += resume.company.candidates.where(phone: phone).to_a if phone
    contact_matches.uniq!

    # No same-named contact match, but this resume is ALREADY attributed to
    # someone — keep it there. Re-running extraction is not new evidence about who sent
    # it, so a reprocess must not re-attribute a resume that was already
    # resolved. Without this, any resume yielding neither email nor phone (a
    # PDF whose font mangles its own contact line, say) creates a brand-new
    # candidate on every single run and silently strands the previous one —
    # along with its interview, interviewer and feedback history, which live on
    # the candidate rather than the resume.
    candidate = contact_matches.find { |c| same_person_name?(c, data) } || resume.candidate

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
      source: resume.source,
      duplicate_status: contact_matches.any? || weak_match ? :potential_duplicate : :unique_record
    )
    mark_resume_current!(resume, candidate)
    candidate
  end

  # A resume sent through the careers website came with a form, and the name,
  # email and phone typed there beat whatever the AI read off the file — so
  # they are what the candidate is matched on and saved with. The AI's own
  # first/last split is kept when its name is the same person's.
  def with_application_details(resume, data)
    application = resume.job_application
    return data unless application

    read_name = data[:full_name].presence || [ data[:first_name], data[:last_name] ].compact_blank.join(" ")
    names = same_name?(application.name, read_name) ? {} : application.name_parts
    data.merge(full_name: application.name, email: application.email, phone: application.phone, **names)
  end

  # The application and the confirmation mail it triggered were waiting for
  # a candidate; this is it.
  def link_application(resume, candidate)
    application = resume.job_application
    return unless application

    application.update!(candidate: candidate)
    RecruitmentEmail.where(candidate_resume_id: resume.id, candidate_id: nil).update_all(candidate_id: candidate.id)
  end

  def normalize_name(name)
    name.to_s.strip.downcase.gsub(/\s+/, " ").presence
  end

  # Whether the name on this resume is the existing candidate's. Case,
  # spacing and punctuation don't count, nor does word order ("Sharma Rahul")
  # or a middle name on only one side ("Rahul K Sharma" vs "Rahul Sharma") —
  # first and last name matching is enough. A resume with no readable name
  # never matches: there is nothing to confirm it is the same person.
  def same_person_name?(candidate, data)
    same_name?(data[:full_name].presence || [ data[:first_name], data[:last_name] ].compact_blank.join(" "),
               candidate.full_name.presence || [ candidate.first_name, candidate.last_name ].compact_blank.join(" "))
  end

  def same_name?(incoming_name, existing_name)
    incoming = name_words(incoming_name)
    existing = name_words(existing_name)
    return false if incoming.empty? || existing.empty?
    return true if incoming.sort == existing.sort

    incoming.size > 1 && existing.size > 1 && incoming.first == existing.first && incoming.last == existing.last
  end

  def name_words(name)
    name.to_s.downcase.scan(/[[:alnum:]]+/)
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
