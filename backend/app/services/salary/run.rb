module Salary
  # One month's pay run, as the Salary page shows it: who is in it, what each
  # of them is paid, what stops a slip, and the slip itself once there is one.
  #
  #   run = Salary::Run.for_month(Date.new(2026, 9, 1))
  #   run.rows     → one Row per employee, by name
  #   run.summary  → the counts and totals over the top of the page
  #
  # The run is every active employee, plus anybody who already has a slip for
  # the month (someone who left after being paid still shows, with their slip).
  # SalaryController#generate builds one over just the employees asked about,
  # so the page and the endpoint judge eligibility the same way.
  class Run
    NO_SALARY = "No salary on file".freeze
    NO_EMAIL = "No email address on file".freeze
    INACTIVE = "Not an active employee".freeze
    NO_PAN = "No PAN on file".freeze
    NO_BANK = "No bank account on file".freeze
    # A slip can't be generated or sent with one of these. PAN and bank are
    # only warnings: the slip prints "--" in their place.
    BLOCKING = [ INACTIVE, NO_SALARY, NO_EMAIL ].freeze

    # `projected` is what a slip would print from the salary on file today —
    # nil without one; `slip` the month's SalarySlip, if generated.
    Row = Data.define(:employee, :decision, :slip, :recipient, :issues, :projected) do
      def eligible? = (issues & BLOCKING).empty?

      # The slip's own figures once there is one; until then, the projection.
      def amounts
        slip ? { gross: slip.gross, deductions: slip.deductions, net: slip.net } : projected
      end

      # The salary on file has changed since the slip was generated, so
      # regenerating would print different figures.
      def outdated?
        slip.present? && projected.present? && projected.transform_values { |value| value.round(2) } != amounts
      end
    end

    def self.for_month(month)
      in_run = Employee.active.or(Employee.where(id: SalarySlip.where(month: month).select(:employee_id)))
      new(month, in_run)
    end

    # `month` is the first of the month; `employees` any Employee relation.
    def initialize(month, employees)
      @month = month
      @employees = employees
    end

    def rows
      @rows ||= begin
        employees = @employees.includes(:company, :designation, :department, :user, profile_photo_attachment: :blob)
                              .order(:first_name, :last_name, :id).to_a
        ids = employees.map(&:id)
        decisions = Source.latest_decisions(ids)
        slips = SalarySlip.where(month: @month, employee_id: ids).index_by(&:employee_id)
        employees.map { |employee| row(employee, decisions[employee.id], slips[employee.id]) }
      end
    end

    def summary
      counted = rows.select { |row| row.slip || row.eligible? }
      {
        employees: rows.size,
        with_salary: rows.count(&:decision),
        eligible: rows.count(&:eligible?),
        generated: rows.count(&:slip),
        sent: rows.count { |row| row.slip&.sent? },
        total_gross: total(counted, :gross),
        total_deductions: total(counted, :deductions),
        total_net: total(counted, :net)
      }
    end

    private
      def row(employee, decision, slip)
        recipient = Source.recipient(employee)
        issues = []
        issues << INACTIVE unless employee.active?
        issues << NO_SALARY if decision.nil?
        issues << NO_EMAIL if recipient.nil?
        issues << NO_PAN if employee.pan_number.blank?
        issues << NO_BANK if employee.bank_account_number.blank?
        projected = decision && SlipPdf.new(employee: employee, breakdown: decision.breakdown, month: @month).amounts

        Row.new(employee:, decision:, slip:, recipient:, issues:, projected:)
      end

      def total(rows, key) = rows.sum { |row| row.amounts&.fetch(key) || 0 }
  end
end
