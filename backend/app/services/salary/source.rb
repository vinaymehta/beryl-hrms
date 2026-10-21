module Salary
  # Where a salary slip's numbers, and its address, come from.
  #
  # There is no payroll yet, so the salary is the one the company last put in
  # writing: the compensation breakdown on the employee's most recent RELEASED
  # appraisal — exactly the rows their appraisal letter printed. An appraisal
  # still in progress doesn't count (its decision can change until release),
  # and nor does an old decision saved before the letter had a breakdown.
  #
  # When payroll arrives, this is the one place that changes; the page, the
  # slip and the mail only ever ask it.
  module Source
    # { employee_id => AppraisalCompensationDecision } for those of the given
    # employees that have a salary on file. One query, whatever the count.
    def self.latest_decisions(employee_ids)
      AppraisalCompensationDecision
        .joins(:appraisal)
        .where(appraisals: { employee_id: employee_ids })
        .where.not(appraisals: { released_at: nil })
        .where.not(compensation_breakdown: {})
        .select("DISTINCT ON (appraisals.employee_id) appraisal_compensation_decisions.*, " \
                "appraisals.employee_id AS salary_employee_id")
        .order("appraisals.employee_id, appraisals.released_at DESC, appraisal_compensation_decisions.id DESC")
        .index_by(&:salary_employee_id)
    end

    def self.latest_decision(employee) = latest_decisions([ employee.id ])[employee.id]

    # The work address — the one they sign in with — and their personal one
    # only for somebody who has no login. nil when there is neither.
    def self.recipient(employee)
      employee.user&.email_address.presence || employee.personal_email.presence
    end
  end
end
