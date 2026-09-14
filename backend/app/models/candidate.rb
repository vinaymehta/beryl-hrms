class Candidate < ApplicationRecord
  acts_as_tenant(:company)

  belongs_to :company
  has_many :candidate_resumes, dependent: :destroy
  has_many :candidate_skills, dependent: :destroy
  has_many :candidate_qualifications, dependent: :destroy
  has_many :candidate_experiences, dependent: :destroy
  has_many :candidate_certifications, dependent: :destroy
  has_many :candidate_job_matches, dependent: :destroy
  has_many :jobs, through: :candidate_job_matches
  has_many :ai_processing_logs, dependent: :nullify

  # The interviewer is an existing Employee, never a free-text name, so the
  # picker can only offer real people and the record stays linked if they
  # are later renamed.
  belongs_to :interviewer, class_name: "Employee", optional: true

  # 0-6 are the pre-existing values and keep their numbers — the interview
  # stage is appended rather than renumbered so no stored row changes meaning.
  #
  # 7-10 are the post-shortlist workflow:
  #   shortlisted -> interview_scheduled -> interview_completed
  #                  -> feedback_not_received / feedback_received
  # `interviewing` (3) predates this and is left untouched; the workflow uses
  # the explicit interview_* values so the wording matches the UI exactly.
  enum :status, {
    needs_review: 0,
    applied: 1,
    screening: 2,
    interviewing: 3,
    shortlisted: 4,
    offered: 5,
    rejected: 6,
    interview_scheduled: 7,
    interview_completed: 8,
    feedback_received: 9,
    feedback_not_received: 10
  }, default: :needs_review

  # Statuses that mean "this candidate has moved past the automatic
  # eligibility decision into the human-run interview workflow". Resume
  # reprocessing must not drag them back to shortlisted/rejected — see
  # ResumeExtractionJob.
  INTERVIEW_WORKFLOW_STATUSES = %w[
    interview_scheduled interview_completed feedback_received feedback_not_received
  ].freeze

  def in_interview_workflow?
    INTERVIEW_WORKFLOW_STATUSES.include?(status)
  end

  FEEDBACK_RATING_RANGE = (1..5).freeze

  # Feedback the CANDIDATE submits about their interview experience, via the
  # public form. Ratings are bounded so a malformed submission on an endpoint
  # with no session behind it can't store nonsense.
  validates :feedback_rating,
            inclusion: { in: FEEDBACK_RATING_RANGE, message: "must be between 1 and 5" },
            allow_nil: true

  def feedback_submitted?
    feedback_submitted_at.present?
  end

  # The candidate's only credential on the public feedback endpoint, so it has
  # to be unguessable — generated once and reused, so a resent request links to
  # the same form rather than orphaning the previous link.
  def ensure_feedback_token!
    return feedback_token if feedback_token.present?

    update_column(:feedback_token, SecureRandom.urlsafe_base64(32))
    feedback_token
  end

  enum :duplicate_status, {
    unique_record: 0,
    potential_duplicate: 1,
    confirmed_duplicate: 2
  }, default: :unique_record

  validates :full_name, presence: true

  # An interview cannot exist without when it is and who is running it.
  # Enforced on the record itself, not just in the controller, so no path
  # (console, future endpoint, import) can leave a half-scheduled interview.
  with_options if: :interview_scheduled? do
    validates :interview_at, presence: { message: "and time are required to schedule an interview" }
    validates :interviewer_id, presence: { message: "must be selected to schedule an interview" }
  end

  validate :interviewer_must_belong_to_same_company

  scope :by_city, ->(city) { where("LOWER(city) = ?", city.to_s.strip.downcase) if city.present? }
  scope :by_qualification, ->(qual) {
    if qual.present?
      where(
        "LOWER(highest_qualification) LIKE :q OR EXISTS (
          SELECT 1 FROM candidate_qualifications cq
          WHERE cq.candidate_id = candidates.id AND LOWER(cq.degree) LIKE :q
        )",
        q: "%#{qual.to_s.strip.downcase}%"
      )
    end
  }
  scope :by_min_experience, ->(years) { where("experience_years >= ?", years.to_f) if years.present? }
  scope :by_skill, ->(skill) {
    if skill.present?
      where(
        "EXISTS (
          SELECT 1 FROM candidate_skills cs
          WHERE cs.candidate_id = candidates.id AND LOWER(cs.name) = :s
        )",
        s: skill.to_s.strip.downcase
      )
    end
  }
  scope :by_state, ->(state) { where("LOWER(state) = ?", state.to_s.strip.downcase) if state.present? }
  scope :by_country, ->(country) { where("LOWER(country) = ?", country.to_s.strip.downcase) if country.present? }
  # current_role is double-quoted deliberately: unquoted, it collides with
  # Postgres's reserved CURRENT_ROLE keyword (like CURRENT_USER) and silently
  # evaluates to the connection's DB role name instead of the column.
  scope :by_job_title, ->(title) { where("LOWER(\"current_role\") LIKE ?", "%#{title.to_s.strip.downcase}%") if title.present? }
  scope :by_previous_company, ->(name) {
    if name.present?
      where(
        "EXISTS (
          SELECT 1 FROM candidate_experiences ce
          WHERE ce.candidate_id = candidates.id AND LOWER(ce.company_name) LIKE :q
        )",
        q: "%#{name.to_s.strip.downcase}%"
      )
    end
  }
  scope :by_certification, ->(name) {
    if name.present?
      where(
        "EXISTS (
          SELECT 1 FROM candidate_certifications cc
          WHERE cc.candidate_id = candidates.id AND LOWER(cc.name) LIKE :q
        )",
        q: "%#{name.to_s.strip.downcase}%"
      )
    end
  }
  scope :by_language, ->(language) {
    if language.present?
      where("languages @> ?", [ language.to_s.strip ].to_json)
    end
  }
  scope :by_processing_status, ->(status) {
    if status.present?
      where(
        "EXISTS (
          SELECT 1 FROM candidate_resumes cr
          WHERE cr.candidate_id = candidates.id AND cr.processing_status = :s
        )",
        s: CandidateResume.processing_statuses.fetch(status.to_s, -1)
      )
    end
  }
  scope :by_duplicate_status, ->(status) { where(duplicate_status: status) if status.present? }

  def latest_resume
    candidate_resumes.order(created_at: :desc).first
  end

  def name
    full_name.presence || [first_name, last_name].compact.join(" ").presence || "Unnamed Candidate"
  end

  private

  # acts_as_tenant scopes queries, but a foreign key assigned directly still
  # has to be checked — an interviewer from another company would otherwise
  # be persistable and would leak that employee's name into this tenant's UI.
  def interviewer_must_belong_to_same_company
    return if interviewer_id.blank?
    return if interviewer && interviewer.company_id == company_id

    errors.add(:interviewer, "must be an employee of this company")
  end
end
