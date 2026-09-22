/**
 * Permission keys mirror the backend's seeded catalog (backend/db/seeds.rb).
 * These gate UI visibility ONLY — the Rails API independently enforces every
 * protected action server-side regardless of what the UI shows or hides.
 */
export const PERMISSIONS = {
  employeesView: "employees.view",
  employeesCreate: "employees.create",
  employeesUpdate: "employees.update",
  employeesDelete: "employees.delete",
  // Give an employee a login and decide which Roles it carries. Seeded onto
  // the Admin and HR roles; editable from Settings like any other key, so the
  // UI must never substitute a role-slug check for it.
  employeesManageRoles: "employees.manage_roles",
  // Assign/change an employee's Primary / Secondary / Final manager.
  // Employees hold neither this nor employeesManageRoles, so they can read
  // their manager hierarchy and change nothing about it. Being somebody's
  // manager grants neither key — a manager assignment is not a system role.
  employeesManageReportingManagers: "employees.manage_reporting_managers",
  departmentsView: "departments.view",
  departmentsCreate: "departments.create",
  departmentsUpdate: "departments.update",
  departmentsDelete: "departments.delete",
  designationsView: "designations.view",
  attendanceView: "attendance.view",
  attendanceManage: "attendance.manage",
  leaveView: "leave.view",
  leaveCreate: "leave.create",
  leaveApprove: "leave.approve",
  // --- Performance appraisal ---------------------------------------------
  appraisalTemplatesView: "appraisal_templates.view",
  appraisalTemplatesManage: "appraisal_templates.manage",
  appraisalCyclesView: "appraisal_cycles.view",
  appraisalCyclesManage: "appraisal_cycles.manage",
  /** See every employee's appraisal (HR/Admin). */
  appraisalsViewAll: "appraisals.view_all",
  /** Fill in your own self-appraisal. Held by everyone with a record. */
  appraisalsSubmitSelf: "appraisals.submit_self",
  /**
   * Review at all. Held broadly, because being someone's manager is an
   * assignment rather than a system role — the backend still refuses unless the
   * appraisal actually names you at the stage it is sitting at.
   */
  appraisalsReview: "appraisals.review",
  appraisalsRelease: "appraisals.release",
  appraisalsManageCompensation: "appraisals.manage_compensation",
  notificationsView: "notifications.view",
  // --- Phase 1 profile records / Phase 5 continuous performance ----------
  /** Read employment history company-wide. Employees read their own via policy. */
  employeeHistoryView: "employee_history.view",
  /** Restricted pay data — Admin/Accounts only, and never the employee. */
  compensationManage: "compensation.manage",
  assetsManage: "assets.manage",
  goalsManage: "goals.manage",
  skillsManage: "skills.manage",
  trainingManage: "training.manage",
  pipManage: "pip.manage",
  /** Request optional 360° feedback (§21). Responding needs no key. */
  appraisalFeedbackManage: "appraisal_feedback.manage",
  payrollView: "payroll.view",
  payrollManage: "payroll.manage",
  expensesView: "expenses.view",
  expensesCreate: "expenses.create",
  expensesApprove: "expenses.approve",
  mailView: "mail.view",
  mailSearch: "mail.search",
  // Confirmed against the backend's ZohoConnectionPolicy#create_company? —
  // connecting/disconnecting the shared company mailbox reuses this
  // existing permission rather than a new mail-specific one.
  zohoConnectionsManage: "zoho_connections.manage",
  documentsView: "documents.view",
  documentsCreate: "documents.create",
  documentsDelete: "documents.delete",
  // Upload confined to the holder's own employee record — see DocumentPolicy.
  documentsManageOwn: "documents.manage_own",
  recruitmentView: "recruitment.view",
  recruitmentManage: "recruitment.manage",
  candidatesView: "candidates.view",
  candidatesManage: "candidates.manage",
  resumesView: "resumes.view",
  resumesProcess: "resumes.process",
  jobsView: "jobs.view",
  jobsManage: "jobs.manage",
  usersView: "users.view",
  usersManage: "users.manage",
  rolesManage: "roles.manage",
  auditLogsView: "audit_logs.view",
} as const

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/** Stable role slugs seeded for every company (backend `roles.slug`). */
export const ROLE_SLUGS = {
  admin: "admin",
  hr: "hr",
  account: "account",
  employee: "employee",
} as const

export type RoleSlug = (typeof ROLE_SLUGS)[keyof typeof ROLE_SLUGS]

/**
 * Role → semantic background/foreground Tailwind classes (see
 * src/app/globals.css and docs/DESIGN_SYSTEM.md). Written as full literal
 * class strings — Tailwind's static scanner can't see classes assembled at
 * runtime via template literals (e.g. `bg-${token}`), so this must stay a
 * lookup of complete strings, not a token you interpolate. Falls back to the
 * neutral "employee" cyan for any custom role a company creates beyond the
 * 4 defaults, since custom roles have no inherent brand color of their own.
 */
export const ROLE_BADGE_CLASSES: Record<RoleSlug | "default", string> = {
  admin: "bg-role-admin text-role-admin-foreground",
  hr: "bg-role-hr text-role-hr-foreground",
  account: "bg-role-accounts text-role-accounts-foreground",
  employee: "bg-role-employee text-role-employee-foreground",
  default: "bg-role-employee text-role-employee-foreground",
}

export function roleBadgeClasses(slug: string): string {
  return ROLE_BADGE_CLASSES[slug as RoleSlug] ?? ROLE_BADGE_CLASSES.default
}

/**
 * "Looks after other people", as opposed to just their own record.
 *
 * Mirrors EmployeePolicy::Scope::MANAGES_PEOPLE on the backend, which is what
 * actually decides whether the employee list returns the whole company or a
 * single row. Keep the two in step — this side only decides what to show.
 */
export const PEOPLE_MANAGEMENT_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.employeesCreate,
  PERMISSIONS.employeesUpdate,
  PERMISSIONS.employeesDelete,
]

/**
 * Anyone who has any business in the Appraisal workspace at all — HR/Admin who
 * run it, managers who review in it, and employees who have their own appraisal
 * there. The tab itself is broad; what each person SEES inside it is decided by
 * the individual keys above and by the backend's own scoping.
 */
export const APPRAISAL_ACCESS_PERMISSIONS: PermissionKey[] = [
  PERMISSIONS.appraisalCyclesView,
  PERMISSIONS.appraisalsViewAll,
  PERMISSIONS.appraisalsSubmitSelf,
  PERMISSIONS.appraisalsReview,
]
