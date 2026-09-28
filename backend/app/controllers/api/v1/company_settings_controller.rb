module Api
  module V1
    # Company-wide preferences that are not big enough to be a resource of
    # their own. One row exists per company already — the Company itself — so
    # this is a singular endpoint over that, not a collection.
    class CompanySettingsController < Api::V1::BaseController
      def show
        authorize current_company, policy_class: CompanySettingPolicy
        render_data(payload)
      end

      def update
        authorize current_company, policy_class: CompanySettingPolicy

        # Only the keys actually sent are changed, so the Initial ID page and
        # the Company page can each save without clearing the other's fields.
        changes = {}
        # Blank clears it, which is how a company turns the suggestion off
        # again rather than being stuck with a pattern it no longer wants.
        changes[:employee_code_initial] = params[:employee_code_initial].to_s.strip.presence if params.key?(:employee_code_initial)
        changes[:name] = params[:name].to_s.strip if params.key?(:name)
        if params.key?(:work_email_domain)
          # Stored bare — "berylsystems.com", not "@berylsystems.com" — which
          # is the form AccountProvisioner compares against.
          changes[:work_email_domain] = params[:work_email_domain].to_s.strip.downcase.delete_prefix("@").presence
        end
        if params.key?(:work_email_domain_enforced)
          changes[:work_email_domain_enforced] = ActiveModel::Type::Boolean.new.cast(params[:work_email_domain_enforced])
        end

        before = current_company.attributes.slice(*changes.keys.map(&:to_s))
        current_company.update!(changes)

        ::Audit::Record.call(
          action: "company.settings_updated", auditable: current_company, request: request,
          before_changes: before,
          after_changes: current_company.attributes.slice(*changes.keys.map(&:to_s))
        )
        render_data(payload)
      end

      private
        def payload
          {
            employeeCodeInitial: current_company.employee_code_initial,
            # Shown beside the field so the effect of the setting is visible
            # before anybody opens the employee form to find out.
            nextEmployeeCode: ::Employees::NextCode.call(company: current_company),
            # The form mirrors this rule so a wrong address is caught as the
            # person types rather than after a round trip. It is a setting
            # rather than a constant because each tenant has its own domain.
            # Null when the check is switched off, so the form accepts any
            # address exactly as the server will.
            workEmailDomain: current_company.enforced_work_email_domain,
            # The Company settings page: the stored domain and the switch,
            # shown even while the check is off.
            companyName: current_company.name,
            workEmailDomainSetting: current_company.work_email_domain,
            workEmailDomainEnforced: current_company.work_email_domain_enforced
          }
        end
    end
  end
end
