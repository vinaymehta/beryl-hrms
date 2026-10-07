# The two appraisal emails that carry the appraisal letter itself, which is
# why they are not the generic NotificationMailer#notify: that one carries no
# content on principle, and these exist to deliver a document.
#
#   letter_issued — to the employee, at release: their letter to read and sign.
#   letter_signed — to Admin/HR, once signed: the signed copy, with its audit page.
#
# Each is built from the in-app Notification Appraisals::Notifier just created,
# so the email and the bell say the same thing and point to the same place.
# The letter is the employee's own document; the review and its ratings still
# never travel by mail.
class AppraisalMailer < ApplicationMailer
  def letter_issued(notification)
    prepare(notification)
    @button = "Review & sign"
    attach_letter(@appraisal.letter_pdf, Appraisals::Release.letter_filename(@appraisal))

    mail(to: @user.email_address, subject: notification.title)
  end

  def letter_signed(notification)
    prepare(notification)
    @button = "Open the appraisal"
    attach_letter(@appraisal.signed_letter_pdf, Appraisals::Release.letter_filename(@appraisal, suffix: "signed"))

    mail(to: @user.email_address, subject: "#{notification.title}: #{@appraisal.employee.full_name}")
  end

  private
    def prepare(notification)
      @notification = notification
      @user = notification.user
      @appraisal = notification.notifiable
      @context = Array(notification.email_context)
      @url = "#{frontend_base_url.chomp('/')}#{notification.action_url}"
    end

    # Skipped rather than raising when the file is missing: the message still
    # says where to find the letter in the app, which is better than no mail.
    #
    # Not attempted on the Zoho transport, which posts only the HTML body to
    # Zoho's API (Zoho::MailDelivery) — the file would be dropped on the way
    # and the message would claim an attachment that never arrives.
    def attach_letter(attachment, filename)
      return if delivery_method == :zoho
      return unless attachment.attached?

      attachments[filename] = { mime_type: "application/pdf", content: attachment.download }
      @letter_attached = true
    rescue StandardError => e
      Rails.logger.warn("[AppraisalMailer] could not attach the letter for appraisal ##{@appraisal&.id}: #{e.class}: #{e.message}")
      @letter_attached = false
    end
end
