module Appraisals
  # Every notification the appraisal workflow raises, named after the event
  # rather than the recipient — the recipient is derived here so callers can't
  # get it wrong.
  #
  # Each message names the NEXT responsible person and what is pending, which is
  # the whole point: a notification that doesn't say whose move it is just adds
  # noise.
  class Notifier
    def self.self_appraisal_opened(appraisal)
      deliver_to_employee(
        appraisal,
        category: "appraisal.self_appraisal_opened",
        title: "Your self-appraisal is open",
        body: "#{appraisal.appraisal_cycle.name} — complete and submit your self-appraisal#{deadline_phrase(appraisal.appraisal_cycle.employee_submission_deadline)}.",
        email_context: context_for(appraisal, action: "Complete and submit your self-appraisal", stage: "Self-appraisal", deadline: :employee)
      )
    end

    def self.submission_due(appraisal)
      deliver_to_employee(
        appraisal,
        category: "appraisal.submission_due",
        title: "Your self-appraisal is due soon",
        body: "#{appraisal.appraisal_cycle.name} — your self-appraisal is still to be submitted#{deadline_phrase(appraisal.appraisal_cycle.employee_submission_deadline)}.",
        email_context: context_for(appraisal, action: "Submit your self-appraisal", stage: "Self-appraisal", deadline: :employee)
      )
    end

    # Addressed to whoever is holding it up, which for the self-appraisal stage
    # is the employee themselves — hence the wording switch.
    # role: :employee, :manager (whoever's level it is now) or :final
    # (Admin/HR, who hold the Final review between them).
    def self.overdue(appraisal, role:)
      name = appraisal.employee.full_name
      kwargs = {
        category: "appraisal.overdue",
        email_context: context_for(appraisal, action: "This is past its deadline", stage: stage_label(appraisal), deadline: role.to_sym)
      }

      case role.to_s
      when "employee"
        deliver_to_employee_record(appraisal, appraisal.employee, title: "Appraisal action overdue",
                                   body: "Your self-appraisal for #{appraisal.appraisal_cycle.name} is past its deadline.", **kwargs)
      when "manager"
        deliver_to_employee_record(appraisal, appraisal.current_reviewer,
                                   title: "#{name}'s appraisal review is overdue",
                                   body: "#{name}'s appraisal is past its manager review deadline.", **kwargs)
      when "final"
        deliver_to_permission_holders(appraisal, FINAL_REVIEW_PERMISSION,
                                      title: "#{name}'s final review is overdue",
                                      body: "#{name}'s appraisal is past its final review deadline.", **kwargs)
      end
    end

    # "Your review is pending" — sent to whoever the workflow just handed it to.
    def self.review_pending(appraisal, level:)
      deliver_to_employee_record(
        appraisal, appraisal.reviewer_id_at(level) && Employee.find_by(id: appraisal.reviewer_id_at(level)),
        category: "appraisal.review_pending",
        title: "#{appraisal.employee.full_name}'s appraisal is waiting for your review",
        body: "#{appraisal.employee.full_name} — #{appraisal.appraisal_cycle.name}. You are the level #{level} reviewer.",
        email_context: context_for(appraisal, action: "Review and submit your assessment", stage: "Level #{level} manager review",
                                                deadline: :manager)
      )
    end

    # Every manager level has reviewed (or none was assigned). The Final review
    # is Admin/HR's — whoever holds appraisals.view_all — so all of them hear.
    def self.final_review_pending(appraisal, except_user: nil)
      deliver_to_permission_holders(
        appraisal, FINAL_REVIEW_PERMISSION, except_user: except_user,
        category: "appraisal.review_pending",
        title: "#{appraisal.employee.full_name}'s appraisal is ready for final review",
        body: "#{appraisal.employee.full_name} — #{appraisal.appraisal_cycle.name}. The manager reviews are complete.",
        email_context: context_for(appraisal, action: "Complete the final review", stage: "Final review", deadline: :final)
      )
    end

    # The final review is in and the appraisal is sitting at the discussion
    # step. Nobody is named on the appraisal for what comes next — releasing it
    # is an HR duty, not a snapshotted reviewer slot — so this is addressed to
    # whoever holds the permission. Without it an appraisal reaches the end of
    # its review chain and waits silently for someone to notice.
    def self.ready_for_release(appraisal, except_user: nil)
      deliver_to_permission_holders(
        appraisal, "appraisals.release", except_user: except_user,
        category: "appraisal.ready_for_release",
        title: "#{appraisal.employee.full_name}'s appraisal letter is ready to send",
        body: "#{appraisal.employee.full_name} — #{appraisal.appraisal_cycle.name}. The final review is complete.",
        email_context: context_for(appraisal, action: "Release the appraisal to the employee", stage: "Ready to release",
                                  deadline: :final)
      )
    end

    def self.returned_for_correction(appraisal, note)
      deliver_to_employee(
        appraisal,
        category: "appraisal.returned",
        title: "Your appraisal was returned for correction",
        body: note.presence || "Your appraisal has been reopened — please review and resubmit.",
        email_context: context_for(appraisal, action: "Review the feedback and resubmit", stage: "Returned for correction",
                                  deadline: :employee)
      )
    end

    # Released: the employee's appraisal letter is out. One notification, not
    # the old "released" + "acknowledgement required" pair — there is one thing
    # for them to do, which is read the letter and sign it.
    #
    # In-app through Deliver with its generic email switched off, because this
    # email is not the generic one: it carries the letter itself as a PDF
    # (AppraisalMailer#letter_issued). The letter is the employee's own, and
    # sending it to them is the point; nothing about the review travels.
    def self.letter_issued(appraisal)
      notification = deliver_to_employee(
        appraisal,
        category: "appraisal.letter_issued",
        title: "Your appraisal letter is ready to sign",
        body: "#{appraisal.appraisal_cycle.name} — please read your appraisal letter and sign it to accept.",
        email_context: context_for(appraisal, action: "Review and sign your appraisal letter", stage: "Released"),
        email: false
      )
      deliver_letter_mail(:letter_issued, notification)
    end

    # Signed: the letter goes back to Admin/HR — whoever holds
    # appraisals.view_all — with the signed PDF attached, and the reviewers
    # hear that it is done. A reviewer who is also Admin/HR is told once, as
    # Admin/HR. The employee who signed is not told about their own signature.
    def self.letter_signed(appraisal)
      signer = appraisal.employee&.user
      admins = User.where(company_id: appraisal.company_id).with_permission(FINAL_REVIEW_PERMISSION)
      admins = admins.where.not(id: signer.id) if signer
      admins = admins.to_a

      shared = {
        category: "appraisal.letter_signed",
        title: "#{appraisal.employee.full_name} has signed their appraisal letter",
        body: "#{appraisal.employee.full_name} has signed their appraisal letter for #{appraisal.appraisal_cycle.name}."
      }

      admins.each do |user|
        notification = ::Notifications::Deliver.call(
          user: user, action_url: "/appraisals/#{appraisal.id}", notifiable: appraisal, email: false,
          email_context: context_for(appraisal, action: "No action needed — the signed letter is attached",
                                                stage: "Letter signed"),
          **shared
        )
        deliver_letter_mail(:letter_signed, notification)
      end

      told = admins.map(&:id) + [ signer&.id ]
      appraisal.reviewers.each do |reviewer|
        next if told.include?(reviewer.user_id)

        deliver_to_employee_record(
          appraisal, reviewer,
          email_context: context_for(appraisal, action: "No action needed — for your information", stage: "Letter signed"),
          **shared
        )
      end
    end

    # Every manager level that reviewed it — each authored a version of it.
    def self.acknowledged(appraisal)
      appraisal.reviewers.each do |recipient|
        deliver_to_employee_record(
          appraisal, recipient,
          category: "appraisal.acknowledged",
          title: "#{appraisal.employee.full_name} has acknowledged their appraisal",
          body: "#{appraisal.employee.full_name} has acknowledged their appraisal.",
          email_context: context_for(appraisal, action: "No action needed — for your information", stage: "Acknowledged")
        )
      end
    end

    # Who holds the Final review: Admin/HR, by permission rather than by name.
    FINAL_REVIEW_PERMISSION = "appraisals.view_all".freeze

    def self.stage_label(appraisal)
      appraisal.manager_review? ? "Level #{appraisal.review_level} manager review" : appraisal.status.humanize
    end

    def self.deadline_phrase(date)
      date.present? ? " by #{date.strftime('%-d %b %Y')}" : ""
    end

    # The labelled lines the email carries under the message.
    #
    # Deliberately nothing sensitive: the cycle, who it is about, what stage it
    # is at and what is being asked. No ratings, no scores, no review
    # commentary — an appraisal's content stays behind the login, and mail is
    # the one channel whose audience we do not control.
    #
    # `deadline:` names WHOSE deadline applies to this message — the step being
    # asked for, not always the self-appraisal one. It used to print the
    # employee submission date on every email, so a manager asked to review was
    # shown the employee's (already past) date instead of their own. nil for
    # messages that ask nobody to do anything by a date (released, acknowledged).
    DEADLINES = {
      employee: [ "Self-appraisal deadline", :employee_submission_deadline ],
      manager: [ "Manager review deadline", :primary_review_deadline ],
      final: [ "Final review deadline", :finalization_deadline ]
    }.freeze

    def self.context_for(appraisal, action:, stage: nil, deadline: nil)
      cycle = appraisal.appraisal_cycle
      label, column = DEADLINES[deadline]
      date = column && cycle.public_send(column)
      [
        [ "Employee", appraisal.employee.full_name ],
        [ "Appraisal cycle", cycle.name ],
        stage.present? ? [ "Stage", stage ] : nil,
        [ "Action required", action ],
        date.present? ? [ label, date.strftime("%-d %b %Y") ] : nil
      ].compact
    end

    def self.deliver_to_employee(appraisal, **kwargs)
      deliver_to_employee_record(appraisal, appraisal.employee, **kwargs)
    end

    def self.deliver_to_employee_record(appraisal, employee, **kwargs)
      ::Notifications::Deliver.to_employee(
        employee,
        action_url: "/appraisals/#{appraisal.id}",
        notifiable: appraisal,
        **kwargs
      )
    end

    # The actor is skipped: telling somebody that the thing they just did is now
    # waiting for them is noise, and HR acting as their own final reviewer is
    # ordinary in a small company.
    def self.deliver_to_permission_holders(appraisal, permission, except_user: nil, **kwargs)
      recipients = User.where(company_id: appraisal.company_id).with_permission(permission)
      recipients = recipients.where.not(id: except_user.id) if except_user

      recipients.find_each do |user|
        ::Notifications::Deliver.call(
          user: user,
          action_url: "/appraisals/#{appraisal.id}",
          notifiable: appraisal,
          **kwargs
        )
      end
    end

    # The letter emails, queued after the in-app notification exists. Same
    # rule as Deliver#send_email: a mail queue being down must never fail the
    # release or the signing that raised it.
    def self.deliver_letter_mail(method, notification)
      return notification if notification.nil? || notification.user.email_address.blank?

      AppraisalMailer.public_send(method, notification).deliver_later
      notification
    rescue StandardError => e
      Rails.logger.error("[appraisal] #{method} email for notification ##{notification&.id} could not be queued: " \
                         "#{e.class}: #{e.message}")
      notification
    end

    private_class_method :deliver_to_employee, :deliver_to_employee_record,
                         :deliver_to_permission_holders, :deliver_letter_mail
  end
end
