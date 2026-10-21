# An employee's monthly salary slip, as a PDF attachment. Sent one slip at a
# time by SalarySlipJob, from the Salary page's pay run.
#
# The attachment is the PDF stored on the SalarySlip when it was generated —
# the same document the page showed for review — never a fresh render.
#
# The mail says only what the attachment is; the figures travel in the PDF,
# never in the message body, which mail clients preview.
class SalarySlipMailer < ApplicationMailer
  # `to` is the address already chosen for this employee.
  def slip(salary_slip, to)
    @employee = salary_slip.employee
    @period = Salary::SlipPdf.period(salary_slip.month)
    @company_name = @employee.company.letter_legal_name

    attachments[salary_slip.pdf.filename.to_s] = { mime_type: "application/pdf", content: salary_slip.pdf.download }

    mail(to: to, subject: "Your salary slip — #{@period}")
  end
end
