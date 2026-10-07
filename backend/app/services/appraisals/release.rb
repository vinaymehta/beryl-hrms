module Appraisals
  # HR/Admin releasing a finalized appraisal to the employee. This is the moment
  # the employee's view changes: before it they see only their own V1 and the
  # status; after it they additionally see their appraisal letter and every
  # comment marked employee_visible. (The final review itself stays with
  # management — what the employee receives is the letter, not the feedback.)
  #
  # The letter is generated HERE, from the saved Discussion decision, and
  # stored with its SHA-256 — so the file the employee is emailed, reads and
  # signs is one fixed document rather than something re-rendered each time it
  # is opened. Workflow#announce then sends it (Notifier.letter_issued).
  class Release
    class Error < StandardError; end

    def self.call(...) = new(...).call

    def initialize(appraisal:, actor: Current.user, notes: nil)
      @appraisal = appraisal
      @actor = actor
      @notes = notes
    end

    def call
      # compensation_approval stays in the list although nothing enters it any
      # more: an appraisal already parked there when the step was withdrawn
      # must still be releasable rather than stranded.
      unless %w[appraisal_discussion compensation_approval].include?(@appraisal.status)
        raise Error, "An appraisal can only be released after the discussion step"
      end
      raise Error, "This appraisal has no final review to release" if @appraisal.revision_for(:final_review).nil?

      letter = generate_letter

      ActiveRecord::Base.transaction do
        @appraisal.letter_pdf.attach(io: StringIO.new(letter), filename: self.class.letter_filename(@appraisal),
                                     content_type: "application/pdf")
        @appraisal.update!(released_at: Time.current, released_by: @actor,
                           letter_sha256: Digest::SHA256.hexdigest(letter))
        Workflow.new(appraisal: @appraisal, to: :released, actor: @actor, notes: @notes).call
      end

      @appraisal
    end

    # "appraisal-letter-emp042-annual-review-2025-26.pdf"
    def self.letter_filename(appraisal, suffix: nil)
      parts = [ "appraisal-letter", appraisal.employee&.employee_code, appraisal.appraisal_cycle&.name, suffix ]
      "#{parts.compact_blank.join('-').parameterize}.pdf"
    end

    private
      # Refused, not defaulted: a letter without a decision behind it would
      # state a salary nobody chose. Checked before anything is written, so a
      # refusal leaves the appraisal exactly where it was.
      def generate_letter
        decision = @appraisal.compensation_decision
        raise Error, "Save the decision with an effective date before releasing." if decision.nil? || !decision.persisted?

        blocker = decision.letter_blocker
        raise Error, blocker if blocker

        LetterPdf.call(@appraisal)
      rescue LetterPdf::Error => e
        raise Error, e.message
      end
  end
end
