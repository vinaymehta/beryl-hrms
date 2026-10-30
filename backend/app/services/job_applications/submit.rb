module JobApplications
  # One application from the careers website, checked and saved: the resume
  # goes into the normal Recruitment pipeline (ResumeProcessingJob, then
  # ResumeExtractionJob, which finds or creates the candidate), and the
  # applicant gets an "application received" email. Nothing slow happens here
  # — the AI work is all in those jobs.
  #
  # Runs inside the careers company's tenant (see the controller). Field names
  # in errors are the website's own snake_case ones.
  class Submit
    Result = Data.define(:status, :application, :errors)

    MAX_RESUME_SIZE = 5.megabytes
    LIMITS = { name: 150, email: 254, phone: 30, role_answer: 3_000, portfolio_url: 500 }.freeze
    PHONE_FORMAT = /\A\+?[0-9 ().-]+\z/
    PHONE_DIGITS = 7..15
    PDF = "application/pdf".freeze
    DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document".freeze
    # Word 97-2003. The container is generic OLE (Excel and Outlook use it
    # too), so only a .doc name makes it a Word file.
    OLE = "application/x-ole-storage".freeze
    DOC = "application/msword".freeze

    def self.call(...) = new(...).call

    def initialize(opening:, params:, request_ip:)
      @opening = opening
      @params = params
      @request_ip = request_ip
    end

    def call
      errors = validate
      return Result.new(status: :invalid, application: nil, errors: errors) if errors.any?

      application = save
      return Result.new(status: :duplicate, application: nil, errors: []) unless application

      ResumeProcessingJob.perform_later(application.candidate_resume_id)
      CandidateMailer.application_received(application).deliver_later
      Result.new(status: :created, application: application, errors: [])
    end

    private
      # Scalars only: a field sent twice or as a nested hash reads as blank
      # rather than as its #to_s.
      def text(key)
        value = @params[key]
        value.is_a?(String) ? value.strip : ""
      end

      def name = text(:name)
      def email = text(:email)
      def phone = text(:phone)
      def role_answer = text(:role_answer)
      def portfolio_url = text(:portfolio_url)
      def applicant_ip = text(:applicant_ip)

      def resume
        file = @params[:resume]
        file if file.respond_to?(:tempfile) && file.respond_to?(:original_filename)
      end

      def validate
        errors = []
        add = ->(field, message) { errors << { code: "invalid", field: field.to_s, message: message } }

        add.(:name, "Name is required.") if name.empty?
        if email.empty?
          add.(:email, "Email is required.")
        elsif !email.match?(URI::MailTo::EMAIL_REGEXP)
          add.(:email, "Email is not a valid email address.")
        end
        if phone.empty?
          add.(:phone, "Phone is required.")
        elsif !phone.match?(PHONE_FORMAT) || !PHONE_DIGITS.cover?(phone.count("0-9"))
          add.(:phone, "Phone must be #{PHONE_DIGITS.min}–#{PHONE_DIGITS.max} digits, optionally with +, spaces, dashes or brackets.")
        end
        LIMITS.each do |field, max|
          add.(field, "#{field.to_s.humanize} can be at most #{max} characters.") if send(field).length > max
        end
        add.(:portfolio_url, "Portfolio URL must be an http(s) link.") if portfolio_url.present? && !web_url?(portfolio_url)
        add.(:applicant_ip, "Applicant IP is not a valid IP address.") if applicant_ip.present? && !ip?(applicant_ip)

        if resume.nil?
          add.(:resume, "Resume is required.")
        elsif resume.size > MAX_RESUME_SIZE
          add.(:resume, "Resume can be at most #{MAX_RESUME_SIZE / 1.megabyte} MB.")
        elsif resume.size.zero?
          add.(:resume, "Resume is empty.")
        elsif resume_content_type.nil?
          add.(:resume, "Resume must be a PDF, DOC or DOCX file.")
        end

        errors
      end

      def web_url?(value)
        uri = URI.parse(value)
        uri.is_a?(URI::HTTP) && uri.host.present?
      rescue URI::InvalidURIError
        false
      end

      def ip?(value)
        IPAddr.new(value)
        true
      rescue IPAddr::Error
        false
      end

      # From the bytes alone, never the file name or the type the browser
      # claimed — a renamed .exe stays an .exe. nil for anything else.
      def resume_content_type
        @resume_content_type ||= begin
          detected = File.open(resume.tempfile.path, "rb") { |io| Marcel::MimeType.for(io) }
          case detected
          when PDF, DOCX then detected
          when OLE then DOC if File.extname(resume.original_filename.to_s).casecmp?(".doc")
          end
        end
      end

      def file_name
        name = File.basename(resume.original_filename.to_s).strip
        name = "resume#{Rack::Mime::MIME_TYPES.key(resume_content_type) || '.pdf'}" if name.empty?
        name.last(255)
      end

      # nil when this address already applied for this opening recently. The
      # check and the insert hold a transaction-scoped advisory lock on
      # (opening, email), so a double-submitted form can't slip two
      # applications past the check at once.
      def save
        normalized_email = JobApplication.normalize_value_for(:email, email)
        lock_key = Digest::SHA256.digest("job_application/#{@opening.id}/#{normalized_email}").unpack1("q>")

        JobApplication.transaction do
          JobApplication.connection.execute(
            JobApplication.sanitize_sql_array([ "SELECT pg_advisory_xact_lock(?)", lock_key ])
          )
          next if JobApplication.recent_from?(normalized_email, @opening)

          candidate_resume = CandidateResume.create!(
            file_name: file_name,
            content_type: resume_content_type,
            file_size: resume.size,
            processing_status: :pending
          )
          candidate_resume.file.attach(
            io: resume.tempfile.tap(&:rewind), filename: file_name,
            content_type: resume_content_type, identify: false
          )

          JobApplication.create!(
            job_opening: @opening,
            candidate_resume: candidate_resume,
            name: name,
            email: email,
            phone: phone,
            role_answer: role_answer.presence,
            portfolio_url: portfolio_url.presence,
            source_ip: applicant_ip.presence || @request_ip
          )
        end
      end
  end
end
