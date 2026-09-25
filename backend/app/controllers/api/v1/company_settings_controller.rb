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

        before = current_company.employee_code_initial
        # Blank clears it, which is how a company turns the suggestion off
        # again rather than being stuck with a pattern it no longer wants.
        current_company.update!(employee_code_initial: params[:employee_code_initial].to_s.strip.presence)

        ::Audit::Record.call(
          action: "company.settings_updated", auditable: current_company, request: request,
          before_changes: { "employee_code_initial" => before },
          after_changes: { "employee_code_initial" => current_company.employee_code_initial }
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
            workEmailDomain: current_company.work_email_domain
          }
        end
    end
  end
end
