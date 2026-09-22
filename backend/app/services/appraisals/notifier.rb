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

    def self.acknowledged(appraisal)
      %i[final primary].filter_map { |role| recipient_for(appraisal, role) }.uniq.each do |recipient|
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

    private_class_method :deliver_to_employee, :deliver_to_employee_record
  end
end
