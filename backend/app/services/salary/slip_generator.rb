module Salary
  # Renders one employee's slip for a month and keeps it: the PDF goes to the
  # SalarySlip's `pdf` attachment and the amounts it printed onto the row, so
  # what the page lists, what the viewer shows and what is mailed are the same
  # document.
  #
  # Regenerating replaces the PDF and amounts on the same row and puts it back
  # to `generated` — a slip that was sent is unsent, since the new PDF hasn't
  # gone to anyone (the earlier send stays in the audit log). Whether that is
  # allowed is the caller's call (SalaryController#generate).
  class SlipGenerator
    def self.call(...) = new(...).call

    # `decision` is the employee's Salary::Source decision; `actor` the user
    # recorded as having generated it.
    def initialize(employee:, decision:, month:, actor:)
      @employee = employee
      @decision = decision
      @month = month
      @actor = actor
    end

    def call
      document = SlipPdf.new(employee: @employee, breakdown: @decision.breakdown, month: @month)
      bytes = document.call

      slip = SalarySlip.find_or_initialize_by(employee: @employee, month: @month)
      slip.assign_attributes(**document.amounts, status: :generated, generated_at: Time.current, generated_by: @actor,
                             sent_at: nil, sent_to: nil, sent_by: nil)
      SalarySlip.transaction do
        slip.save!
        slip.pdf.attach(io: StringIO.new(bytes), filename: SlipPdf.filename(@employee, @month),
                        content_type: "application/pdf")
      end
      slip
    end
  end
end
