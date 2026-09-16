class DocumentPolicy < ApplicationPolicy
  def index? = permission?("documents.view")
  def show? = permission?("documents.view")

  # Two distinct rights, deliberately not collapsed into one:
  #
  #   documents.create     — HR/Admin: upload against ANY employee.
  #   documents.manage_own — an employee looking after their own paperwork:
  #                          upload to their own record, and remove something
  #                          they uploaded themselves.
  #
  # This class-level check only answers "may this user upload at all". WHOSE
  # record they may upload against is a separate question the controller asks
  # via #upload_for?, because it depends on a parameter rather than on the
  # user alone.
  def create? = permission?("documents.create") || permission?("documents.manage_own")

  # Keyed on who UPLOADED the document, not on whose record it sits against.
  #
  # That distinction is the whole point: an employee who attaches the wrong
  # file can take it straight back down instead of asking HR to do it for
  # them, but they still cannot delete the copy of their own signed contract
  # that HR filed against them. Same record, different uploader, different
  # answer.
  def destroy?
    return true if permission?("documents.delete")

    permission?("documents.manage_own") && own_upload?
  end

  # Reading the file itself carries the same requirement as seeing the
  # record — no separate "download" permission in the catalog.
  def download? = permission?("documents.view")

  # Preview streams the same bytes as download, rendered rather than saved.
  def preview? = download?

  # Whether this user may file a document against this particular employee.
  # documents.create is unrestricted; documents.manage_own is confined to the
  # uploader's own employee record, and cannot be used for the company-wide
  # (employee_id: nil) documents either.
  def upload_for?(employee_id)
    return true if permission?("documents.create")
    return false unless permission?("documents.manage_own")

    own_id = user.employee_record&.id
    own_id.present? && employee_id.present? && employee_id.to_s == own_id.to_s
  end

  private

    def own_upload?
      record.is_a?(Document) && record.uploaded_by_id.present? && record.uploaded_by_id == user.id
    end

  public

  class Scope < ApplicationPolicy::Scope
    # documents.create is the seeded proxy for "HR/Admin, sees every
    # employee's documents" — the catalog has no separate
    # "documents.manage_all" key; only HR/Admin roles carry .create today.
    #
    # documents.manage_own deliberately grants NO extra visibility: an employee
    # holding it still falls through to the own-records-only branch below.
    def resolve
      base = scope.where(company_id: user.company_id)
      return base if user.permission?("documents.create")

      base.where(employee_id: user.employee_record&.id)
    end
  end
end
