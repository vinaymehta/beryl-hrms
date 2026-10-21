# Emails one employee the stored PDF of their salary slip, then marks the
# slip sent and writes the "salary.slip_sent" audit row — after the send, so
# both record slips that actually went, not ones that were only asked for.
#
# One job per slip (see SalaryController#send_slips), so one bad address fails
# and retries on its own instead of holding up the rest of the run.
#
# The address is looked up again here rather than carried in the arguments:
# the job may run after a retry or a backlog, and it should send to what is on
# file then. Nothing is sent if it has gone, if the employee has left, or if
# the slip was sent in the meantime (a second click on Send) — unless this is
# a deliberate resend.
class SalarySlipJob < ApplicationJob
  queue_as :default

  # `actor` is the user who pressed Send, recorded as the one who sent it.
  def perform(slip, actor, resend: false)
    return if slip.sent? && !resend
    return unless slip.employee.active? && slip.pdf.attached?

    to = Salary::Source.recipient(slip.employee)
    return if to.nil?

    SalarySlipMailer.slip(slip, to).deliver_now

    SalarySlip.transaction do
      slip.update!(status: :sent, sent_at: Time.current, sent_to: to, sent_by: actor)
      # The amounts stay out of the audit row: audit_logs.view reaches people
      # who don't hold salary.send. The slip id is enough to find the PDF.
      Audit::Record.call(
        action: "salary.slip_sent", request: nil, actor: actor, company: slip.company, auditable: slip.employee,
        after_changes: { "month" => slip.month.strftime("%Y-%m"), "sent_to" => to, "salary_slip_id" => slip.id }
      )
    end
  end
end
