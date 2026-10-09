module Appraisals
  # The employee signing their appraisal letter — which is how a released
  # appraisal is acknowledged now.
  #
  # The signature is an image: drawn on the signature pad (which exports a
  # PNG) or uploaded (PNG or JPG). Both arrive the same way and are handled the
  # same way; `signature_method` only records which it was.
  #
  # One transaction does all of it, so a signing either happened completely or
  # not at all:
  #   1. the signature image is stored (Appraisal#employee_signature);
  #   2. the signed letter is generated — the letter with the signature in its
  #      signature block — and stored (#signed_letter_pdf);
  #   3. the signing is recorded: signed_at, IP, user agent, name, method, and
  #      acknowledged_at, which everything that already asks "acknowledged?"
  #      reads;
  #   4. a copy is filed in the employee's Documents (category
  #      appraisal_letter), uploaded by the employee themselves;
  #   5. the workflow moves to employee_acknowledged, whose announcement sends
  #      the signed letter to Admin/HR (Notifier.letter_signed).
  class SignLetter
    class Error < StandardError; end

    MAX_BYTES = 2.megabytes
    # Declared content type → the bytes a real file of that type starts with.
    # Both must agree: the type is what the browser claims, and the magic bytes
    # are what the file actually is.
    SIGNATURE_TYPES = {
      "image/png" => "\x89PNG\r\n\x1A\n".b,
      "image/jpeg" => "\xFF\xD8\xFF".b,
      "image/jpg" => "\xFF\xD8\xFF".b
    }.freeze
    METHODS = %w[drawn uploaded].freeze

    def self.call(...) = new(...).call

    def initialize(appraisal:, signature:, accept:, signature_method: nil, actor: Current.user, ip: nil, user_agent: nil)
      @appraisal = appraisal
      @upload = signature
      @accept = ActiveModel::Type::Boolean.new.cast(accept)
      @signature_method = METHODS.include?(signature_method.to_s) ? signature_method.to_s : "uploaded"
      @actor = actor
      @ip = ip
      @user_agent = user_agent.to_s.truncate(500)
    end

    def call
      image, content_type = read_signature
      raise Error, "Please confirm you accept the letter." unless @accept
      raise Error, "This appraisal has no letter to sign yet." unless @appraisal.letter_pdf.attached?
      raise Error, "This letter has already been signed." if @appraisal.letter_signed? || @appraisal.acknowledged_at

      signed_at = Time.current
      name = @appraisal.employee.full_name
      signed_pdf = LetterPdf.call(
        @appraisal,
        signature: LetterPdf::Signature.new(image: image, name: name, signed_at: signed_at)
      )
      signed_filename = Release.letter_filename(@appraisal, suffix: "signed")

      ActiveRecord::Base.transaction do
        @appraisal.employee_signature.attach(
          io: StringIO.new(image), content_type: content_type,
          filename: "signature-#{@appraisal.id}.#{content_type == 'image/png' ? 'png' : 'jpg'}"
        )
        @appraisal.signed_letter_pdf.attach(io: StringIO.new(signed_pdf), filename: signed_filename,
                                            content_type: "application/pdf")
        @appraisal.update!(
          signed_at: signed_at, signed_ip: @ip, signed_user_agent: @user_agent.presence,
          signed_name: name, signature_method: @signature_method, acknowledged_at: signed_at
        )
        file_document(signed_pdf, signed_filename)
        Workflow.new(appraisal: @appraisal, to: :employee_acknowledged, actor: @actor,
                     notes: "Appraisal letter signed").call
      end

      @appraisal
    end

    private
      # The signature's bytes and its (verified) content type. The size is
      # checked before anything is read, so an oversized upload costs nothing.
      def read_signature
        raise Error, "Add your signature first." unless @upload.respond_to?(:read)
        raise Error, "Signature must be 2 MB or smaller." if @upload.size.to_i > MAX_BYTES

        declared = @upload.content_type.to_s.downcase
        magic = SIGNATURE_TYPES[declared]
        bytes = @upload.read.to_s.b
        @upload.rewind if @upload.respond_to?(:rewind)

        raise Error, "Add your signature first." if bytes.empty?
        raise Error, "Signature must be a PNG or JPG image." if magic.nil? || !bytes.start_with?(magic)

        [ bytes, declared == "image/png" ? "image/png" : "image/jpeg" ]
      end

      # Filed as the employee's own upload: it is their signed copy, and the
      # Documents tab is where they (and HR) already look for their papers.
      def file_document(pdf, filename)
        document = Document.new(
          company_id: @appraisal.company_id,
          employee: @appraisal.employee,
          uploaded_by: @appraisal.employee.user || @actor,
          document_type: "appraisal_letter",
          title: "Appraisal letter — #{@appraisal.appraisal_cycle.name} (signed)"
        )
        document.file.attach(io: StringIO.new(pdf), filename: filename, content_type: "application/pdf")
        document.save!
      end
  end
end
