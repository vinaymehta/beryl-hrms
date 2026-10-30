import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboardIcon,
  UsersIcon,
  ClockIcon,
  CalendarDaysIcon,
  FileTextIcon,
  MailIcon,
  BriefcaseIcon,
  CalendarClockIcon,
  BanknoteIcon,
  TrendingUpIcon,
  CircleUserIcon,
  SettingsIcon,
} from "lucide-react"

import {
  PEOPLE_MANAGEMENT_PERMISSIONS,
  APPRAISAL_ACCESS_PERMISSIONS,
  PERMISSIONS,
  type PermissionKey,
} from "@/constants/permissions"
import { HIDDEN_FEATURES } from "@/constants/feature-flags"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Omit for items every authenticated user can see (Settings). An array means "any of these". */
  permission?: PermissionKey | PermissionKey[]
  /**
   * Only show this to a login that has an Employee record of its own.
   *
   * Not expressible as a permission: "My profile" isn't a privilege, it's a
   * question of whether there is anything to show. A bare admin account with
   * no employee record would otherwise get a link that bounces straight back
   * — see app/(dashboard)/profile/page.tsx.
   */
  requiresEmployeeRecord?: boolean
  /**
   * Hide this from anyone holding one of these permissions.
   *
   * The inverse of `permission`, and needed because "My Profile" is for people
   * who have no other way in: HR and Admin reach their own record through the
   * Employees directory they already manage, so a second entry point to the
   * same page is just clutter in their nav.
   */
  hiddenFor?: PermissionKey | PermissionKey[]
  /**
   * Also show this to a login with an Employee record of its own, even
   * without `permission` — anyone can be picked as an interviewer, and the
   * page then shows only their own part.
   */
  alsoForEmployees?: boolean
}

const ALL_NAV_ITEMS: (NavItem & { hidden?: boolean })[] = [
  // The dashboard reports company-wide numbers (headcount, departments), so
  // it is for whoever looks after the company's people. Someone who only
  // manages their own record is sent to that record instead — see
  // app/(dashboard)/page.tsx.
  { label: "Dashboard", href: "/", icon: LayoutDashboardIcon, permission: PEOPLE_MANAGEMENT_PERMISSIONS },
  { label: "Employees", href: "/employees", icon: UsersIcon, permission: PEOPLE_MANAGEMENT_PERMISSIONS },
  // Departments moved INTO Settings (Settings → Department), so it is no
  // longer a top-level destination. Two doors onto the same screen is exactly
  // what the settings reorganisation was for. The /departments route still
  // exists and redirects, for anything already linking to it.
  { label: "Attendance", href: "/attendance", icon: ClockIcon, permission: PERMISSIONS.attendanceView, hidden: HIDDEN_FEATURES.attendance },
  { label: "Leave", href: "/leave", icon: CalendarDaysIcon, permission: PERMISSIONS.leaveView, hidden: HIDDEN_FEATURES.leave },
  { label: "Documents", href: "/documents", icon: FileTextIcon, permission: PERMISSIONS.documentsView, hidden: HIDDEN_FEATURES.documents },
  // Your own record, reached without an id — see app/(dashboard)/profile.
  // Deliberately NOT /employees/<id>: that route is the HR management view of
  // somebody else, and putting an employee's own id in the address bar is an
  // invitation to try a different one.
  //
  // Above Appraisal, so an employee's whole nav reads My Profile, Appraisal,
  // Settings — their own record first, then the work about it.
  //
  // Not shown to HR/Admin: they open their own record from the Employees
  // directory like any other, so this would be a second door onto the same
  // page. The /profile ROUTE still works for them — only the nav entry is
  // withheld.
  {
    label: "My Profile",
    href: "/profile",
    icon: CircleUserIcon,
    requiresEmployeeRecord: true,
    hiddenFor: PEOPLE_MANAGEMENT_PERMISSIONS,
  },
  // Its own top-level workspace, deliberately NOT nested under Employees: an
  // appraisal cycle is a company-wide process, and an ordinary employee reaches
  // their own appraisal here rather than through the people directory.
  { label: "Appraisal", href: "/appraisals", icon: TrendingUpIcon, permission: APPRAISAL_ACCESS_PERMISSIONS },
  // Your own record, reached without an id — see app/(dashboard)/profile.
  // Deliberately NOT /employees/<id>: that route is the HR management view of
  // somebody else, and putting an employee's own id in the address bar is an
  // invitation to try a different one.
  //
  { label: "Recruitment", href: "/recruitment", icon: BriefcaseIcon, permission: PERMISSIONS.recruitmentView },
  // Recruitment access sees every interview (CandidatePolicy#index? on the
  // API); any other employee sees only the interviews they were picked for.
  {
    label: "Interviews",
    href: "/recruitment/interviews",
    icon: CalendarClockIcon,
    permission: [PERMISSIONS.recruitmentView, PERMISSIONS.candidatesView],
    alsoForEmployees: true,
  },
  // The connected Zoho mailboxes (one picker for several). Connecting and
  // disconnecting them is Settings → Mail.
  { label: "Mail", href: "/mail", icon: MailIcon, permission: PERMISSIONS.mailView },
  // The monthly pay run: generate, review and email salary slips. Its own key
  // rather than payroll.*: the page shows everyone's pay at once.
  { label: "Salary", href: "/salary", icon: BanknoteIcon, permission: PERMISSIONS.salarySend },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
]

export const NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((item) => !item.hidden)
