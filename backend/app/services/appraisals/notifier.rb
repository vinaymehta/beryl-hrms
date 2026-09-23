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
        body: "#{appraisal.appraisal_cycle.name} — complete and submit your self-appraisal#{deadline_phrase(appraisal.appraisal_cycle.employee_submission_deadline)}."
      )
    end

    def self.submission_due(appraisal)
      deliver_to_employee(
        appraisal,
        category: "appraisal.submission_due",
        title: "Your self-appraisal is due soon",
        body: "#{appraisal.appraisal_cycle.name} — your self-appraisal is still to be submitted#{deadline_phrase(appraisal.appraisal_cycle.employee_submission_deadline)}."
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
        body: body
      )
    end

    # "Your review is pending" — sent to whoever the workflow just handed it to.
    def self.review_pending(appraisal, role:)
      recipient = recipient_for(appraisal, role)
      deliver_to_employee_record(
        appraisal, recipient,
        category: "appraisal.review_pending",
        title: "An appraisal is waiting for your review",
        body: "#{appraisal.employee.full_name} — #{appraisal.appraisal_cycle.name}. You are the #{role} reviewer."
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
        body: "#{appraisal.employee.full_name} — #{appraisal.appraisal_cycle.name}. The final review is complete."
      )
    end

    # Same reasoning for the optional compensation step: it is gated on a
    # permission, so the people who can act on it are found by that permission.
    def self.compensation_approval_pending(appraisal, except_user: nil)
      deliver_to_permission_holders(
        appraisal, "appraisals.manage_compensation", except_user: except_user,
        category: "appraisal.compensation_approval_pending",
        title: "An appraisal is waiting for compensation approval",
        body: "#{appraisal.employee.full_name} — #{appraisal.appraisal_cycle.name}."
      )
    end

    def self.returned_for_correction(appraisal, note)
      deliver_to_employee(
        appraisal,
        category: "appraisal.returned",
        title: "Your appraisal was returned for correction",
        body: note.presence || "Your appraisal has been reopened — please review and resubmit."
      )
    end

    def self.released(appraisal)
      deliver_to_employee(
        appraisal,
        category: "appraisal.released",
        title: "Your appraisal has been released",
        body: "#{appraisal.appraisal_cycle.name} — your final appraisal is now available to read and acknowledge."
      )
    end

    def self.acknowledgement_required(appraisal)
      deliver_to_employee(
        appraisal,
        category: "appraisal.acknowledgement_required",
        title: "Acknowledgement required",
        body: "Please read and acknowledge your released appraisal for #{appraisal.appraisal_cycle.name}."
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
          body: "#{appraisal.employee.full_name} has acknowledged their appraisal."
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

    private_class_method :deliver_to_employee, :deliver_to_employee_record, :deliver_to_permission_holders
  end
end
