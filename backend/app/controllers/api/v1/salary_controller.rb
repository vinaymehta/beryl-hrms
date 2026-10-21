module Api
  module V1
    # The Salary page: each month is a pay run — slips are generated (rendered
    # and stored as SalarySlip rows), reviewed, then emailed. Everything here
    # is gated by salary.send — see SalaryPolicy.
    class SalaryController < Api::V1::BaseController
      MONTH_FORMAT = /\A(\d{4})-(\d{2})\z/

      # A month or a list the page would never send; answered as a 422 with
      # the message, like any other bad field.
      class InvalidRequest < StandardError; end
      rescue_from InvalidRequest, with: :render_unprocessable

      # The month's run, unpaginated: the page selects across the whole list at
      # once ("select all"), and it is one row per person in a single company.
      def run
        authorize :salary, :index?

        month = requested_month
        run = ::Salary::Run.for_month(month)
        summary = run.summary.to_h do |key, value|
          [ key.to_s.camelize(:lower), key.start_with?("total_") ? storable(value) : value ]
        end
        render_data({ month: month.strftime("%Y-%m"), summary: summary,
                      employees: Api::V1::SalaryEmployeeSerializer.new(run.rows).as_json })
      end

      # Generates — or regenerates — the slip of each employee asked about, and
      # answers with a result for EVERY id: "generated", or "skipped" with the
      # reason, so the page can mark each row rather than report one total.
      #
      # A slip that has already been sent is only regenerated with
      # `regenerate: true`, and goes back to "generated": the new PDF hasn't
      # been sent to anyone. The response's `notice` says so.
      #
      # An id that isn't an employee of this company fails the whole request:
      # the page never offers one, so it is a stale page or a hand-made call.
      def generate
        authorize :salary, :create?

        month = requested_month
        ids = requested_ids(:employee_ids)
        employees = Employee.where(id: ids)
        raise InvalidRequest, "Choose employees from this company's list." if employees.count != ids.size

        regenerate = ActiveModel::Type::Boolean.new.cast(params[:regenerate])
        rows = ::Salary::Run.new(month, employees).rows.index_by { |row| row.employee.id }
        reset = 0
        results = ids.map do |id|
          row = rows.fetch(id)
          reason = row.issues.find { |issue| ::Salary::Run::BLOCKING.include?(issue) }
          reason ||= "Already sent — regenerate to replace it" if row.slip&.sent? && !regenerate
          next generate_result(row, nil, reason) if reason

          reset += 1 if row.slip&.sent?
          slip = ::Salary::SlipGenerator.call(employee: row.employee, decision: row.decision, month: month,
                                              actor: Current.user)
          generate_result(row, slip, nil)
        end

        notice = "#{reset} sent #{'slip'.pluralize(reset)} went back to Generated — send again to deliver the new PDF." if reset.positive?
        render_data({ month: month.strftime("%Y-%m"), results: results, notice: notice })
      end

      # The stored PDF of one slip — inline for the page's viewer, or as an
      # attachment with ?download=1.
      def pdf
        authorize :salary, :index?

        slip = SalarySlip.find(params[:id])
        unless slip.pdf.attached?
          return render json: { errors: [ { code: "not_found", message: "This slip has no PDF." } ] }, status: :not_found
        end

        download = ActiveModel::Type::Boolean.new.cast(params[:download])
        send_data slip.pdf.download, filename: slip.pdf.filename.to_s, type: "application/pdf",
                                     disposition: download ? "attachment" : "inline"
      end

      # Queues one SalarySlipJob per slip that can go, which emails the stored
      # PDF and marks the slip sent once it has. A result for EVERY id asked
      # about: "queued" (the job sends it within moments) or "skipped" with
      # the reason. An already-sent slip is only sent again with `resend: true`.
      def send_slips
        authorize :salary, :create?

        ids = requested_ids(:slip_ids)
        slips = SalarySlip.where(id: ids).includes(pdf_attachment: :blob, employee: :user).index_by(&:id)
        raise InvalidRequest, "Choose slips from this company's pay run." if slips.size != ids.size

        resend = ActiveModel::Type::Boolean.new.cast(params[:resend])
        results = ids.map do |id|
          slip = slips.fetch(id)
          to = ::Salary::Source.recipient(slip.employee)
          reason = send_skip_reason(slip, to, resend)
          SalarySlipJob.perform_later(slip, Current.user, resend: resend) unless reason

          { slipId: id, employeeId: slip.employee_id, fullName: slip.employee.full_name,
            status: reason ? "skipped" : "queued", reason: reason, sentTo: reason ? nil : to }
        end

        render_data({ results: results })
      end

      private
        # "YYYY-MM", no later than the current month in the company's own
        # timezone — a slip is for a month that has at least begun.
        def requested_month
          match = MONTH_FORMAT.match(params.require(:month).to_s)
          month = match && Date.new(match[1].to_i, match[2].to_i, 1)
          raise InvalidRequest, "Month must be in the form YYYY-MM." unless month

          today = (Time.find_zone(current_company.timezone) || Time.zone).today
          raise InvalidRequest, "Salary slips can't be made for a future month." if month > today.beginning_of_month

          month
        rescue Date::Error
          raise InvalidRequest, "Month must be in the form YYYY-MM."
        end

        def requested_ids(key)
          ids = Array(params.require(key)).map(&:to_i).uniq
          raise InvalidRequest, "Choose at least one." if ids.empty?

          ids
        end

        def generate_result(row, slip, reason)
          {
            employeeId: row.employee.id, fullName: row.employee.full_name,
            status: reason ? "skipped" : "generated", reason: reason, slipId: slip&.id
          }
        end

        def send_skip_reason(slip, to, resend)
          return ::Salary::Run::INACTIVE unless slip.employee.active?
          return ::Salary::Run::NO_EMAIL if to.nil?
          return "The slip has no PDF — generate it again" unless slip.pdf.attached?
          return "Already sent" if slip.sent? && !resend

          nil
        end

        def storable(amount) = ::Appraisals::SalaryStructure.storable(amount.round(2))
    end
  end
end
