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

  enum :status, {
    needs_review: 0,
    applied: 1,
    screening: 2,
    interviewing: 3,
    shortlisted: 4,
    offered: 5,
    rejected: 6
  }, default: :needs_review

  enum :duplicate_status, {
    unique_record: 0,
    potential_duplicate: 1,
    confirmed_duplicate: 2
  }, default: :unique_record

  validates :full_name, presence: true

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
end

