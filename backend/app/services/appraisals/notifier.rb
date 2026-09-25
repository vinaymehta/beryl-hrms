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
        email_context: context_for(appraisal, action: "Complete and submit your self-appraisal", stage: "Self-appraisal")
      )
    end

    def self.submission_due(appraisal)
      deliver_to_employee(
        appraisal,
        category: "appraisal.submission_due",
        title: "Your self-appraisal is due soon",
        body: "#{appraisal.appraisal_cycle.name} — your self-appraisal is still to be submitted#{deadline_phrase(appraisal.appraisal_cycle.employee_submission_deadline)}.",
        email_context: context_for(appraisal, action: "Submit your self-appraisal", stage: "Self-appraisal")
      )
    end

    # Addressed to whoever is holding it up, which for the self-appraisal stage
    # is the employee themselves — hence the wording switch.
    def self.overdue(appraisal, role:)
      recipient = recipient_for(appraisal, role)
      body =
        if role.to_s == "employee"
          "Your self-appraisal for #{appraisal.appraisal_cycle.name} is past its deadline."
        else
          "#{appraisal.employee.full_name}'s appraisal is past its #{role} review deadline."
        end

      deliver_to_employee_record(
        appraisal, recipient,
        category: "appraisal.overdue",
        title: "Appraisal action overdue",
        body: body,
        email_context: context_for(appraisal, action: "This is past its deadline", stage: role.to_s.humanize)
      )
    end

    # "Your review is pending" — sent to whoever the workflow just handed it to.
    def self.review_pending(appraisal, role:)
      recipient = recipient_for(appraisal, role)
      deliver_to_employee_record(
        appraisal, recipient,
        category: "appraisal.review_pending",
        title: "An appraisal is waiting for your review",
        body: "#{appraisal.employee.full_name} — #{appraisal.appraisal_cycle.name}. You are the #{role} reviewer.",
        email_context: context_for(appraisal, action: "Review and submit your assessment", stage: "#{role.to_s.humanize} review")
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
        title: "An appraisal is ready to release",
        body: "#{appraisal.employee.full_name} — #{appraisal.appraisal_cycle.name}. The final review is complete.",
        email_context: context_for(appraisal, action: "Release the appraisal to the employee", stage: "Ready to release")
      )
    end

    def self.returned_for_correction(appraisal, note)
      deliver_to_employee(
        appraisal,
        category: "appraisal.returned",
        title: "Your appraisal was returned for correction",
        body: note.presence || "Your appraisal has been reopened — please review and resubmit.",
        email_context: context_for(appraisal, action: "Review the feedback and resubmit", stage: "Returned for correction")
      )
    end

    def self.released(appraisal)
      deliver_to_employee(
        appraisal,
        category: "appraisal.released",
        title: "Your appraisal has been released",
        body: "#{appraisal.appraisal_cycle.name} — your final appraisal is now available to read and acknowledge.",
        email_context: context_for(appraisal, action: "Read and acknowledge your appraisal", stage: "Released")
      )
    end

    def self.acknowledgement_required(appraisal)
      deliver_to_employee(
        appraisal,
        category: "appraisal.acknowledgement_required",
        title: "Acknowledgement required",
        body: "Please read and acknowledge your released appraisal for #{appraisal.appraisal_cycle.name}.",
        email_context: context_for(appraisal, action: "Acknowledge your appraisal", stage: "Released")
      )
    end

    # Everyone who reviewed it, including the secondary — they authored a
    # version of this appraisal, so leaving them out of its closing beat was an
    # oversight rather than a rule.
    def self.acknowledged(appraisal)
      %i[final secondary primary].filter_map { |role| recipient_for(appraisal, role) }.uniq.each do |recipient|
        deliver_to_employee_record(
          appraisal, recipient,
          category: "appraisal.acknowledged",
          title: "Appraisal acknowledged",
          body: "#{appraisal.employee.full_name} has acknowledged their appraisal.",
          email_context: context_for(appraisal, action: "No action needed — for your information", stage: "Acknowledged")
        )
      end
    end

    def self.recipient_for(appraisal, role)
      case role.to_s
      when "employee" then appraisal.employee
      when "primary" then appraisal.primary_manager
      when "secondary" then appraisal.secondary_manager
      when "final" then appraisal.final_manager
      end
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
    def self.context_for(appraisal, action:, stage: nil)
      cycle = appraisal.appraisal_cycle
      [
        [ "Employee", appraisal.employee.full_name ],
        [ "Appraisal cycle", cycle.name ],
        stage.present? ? [ "Stage", stage ] : nil,
        [ "Action required", action ],
        cycle.employee_submission_deadline.present? ? [ "Deadline", cycle.employee_submission_deadline.strftime("%-d %b %Y") ] : nil
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

    private_class_method :deliver_to_employee, :deliver_to_employee_record,
                         :deliver_to_permission_holders
  end
end
