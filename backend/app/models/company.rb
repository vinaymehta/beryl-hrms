class Company < ApplicationRecord
  enum :status, { active: 0, suspended: 1 }, default: :active

  has_many :users, dependent: :destroy
  has_many :employees, dependent: :destroy
  has_many :departments, dependent: :destroy
  has_many :designations, dependent: :destroy
  has_many :employment_types, dependent: :destroy
  has_many :roles, dependent: :destroy
  has_many :zoho_connections, dependent: :destroy
  has_many :calendly_connections, dependent: :destroy
  has_many :audit_logs, dependent: :nullify
  has_many :leave_requests, dependent: :destroy
  has_many :attendance_records, dependent: :destroy
  has_many :documents, dependent: :destroy

  has_many :candidates, dependent: :destroy
  has_many :candidate_resumes, dependent: :destroy
  has_many :candidate_skills, dependent: :destroy
  has_many :candidate_qualifications, dependent: :destroy
  has_many :candidate_experiences, dependent: :destroy
  has_many :candidate_certifications, dependent: :destroy
  has_many :candidate_job_matches, dependent: :destroy
  has_many :jobs, dependent: :destroy
  has_many :ai_processing_logs, dependent: :destroy

  has_many :appraisal_templates, dependent: :destroy
  has_many :appraisal_cycles, dependent: :destroy
  has_many :appraisals, dependent: :destroy
  has_many :notifications, dependent: :destroy

  before_validation :generate_slug, on: :create

  validates :name, presence: true
  validates :slug, presence: true, uniqueness: true, format: { with: /\A[a-z0-9-]+\z/ }
  validates :timezone, presence: true, inclusion: { in: ActiveSupport::TimeZone.all.map(&:name) }

  # The domain every work email must end with — or nil when none is set or the
  # check has been switched off in Settings, meaning any valid address is
  # accepted. The one reader everything that applies the rule goes through.
  def enforced_work_email_domain
    work_email_domain.presence if work_email_domain_enforced?
  end

  # The name the appraisal letter is written on behalf of ("For Beryl Systems
  # Private Limited"). The trading name stands in until one is set, so a
  # letter is never signed off for nobody.
  def letter_legal_name
    legal_name.presence || name
  end

  # The salary rules that pre-fill the letter's compensation table, every gap
  # filled from the defaults (see Appraisals::SalaryStructure). The stored
  # column holds only what Settings changed.
  def salary_rules
    ::Appraisals::SalaryStructure.normalize_rules(salary_structure_rules)
  end

  private
    def generate_slug
      return if slug.present?

      base = name.to_s.parameterize
      candidate = base
      suffix = 1
      while Company.exists?(slug: candidate)
        suffix += 1
        candidate = "#{base}-#{suffix}"
      end
      self.slug = candidate
    end
end
