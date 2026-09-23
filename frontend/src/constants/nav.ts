import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboardIcon,
  UsersIcon,
  Building2Icon,
  ClockIcon,
  CalendarDaysIcon,
  FileTextIcon,
  // Retained (not deleted) for the commented-out Mail nav entry below.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  MailIcon,
  BriefcaseIcon,
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
}

const ALL_NAV_ITEMS: (NavItem & { hidden?: boolean })[] = [
  // The dashboard reports company-wide numbers (headcount, departments), so
  // it is for whoever looks after the company's people. Someone who only
  // manages their own record is sent to that record instead — see
  // app/(dashboard)/page.tsx.
  { label: "Dashboard", href: "/", icon: LayoutDashboardIcon, permission: PEOPLE_MANAGEMENT_PERMISSIONS },
  { label: "Employees", href: "/employees", icon: UsersIcon, permission: PEOPLE_MANAGEMENT_PERMISSIONS },
  { label: "Departments", href: "/departments", icon: Building2Icon, permission: PERMISSIONS.departmentsView },
  { label: "Attendance", href: "/attendance", icon: ClockIcon, permission: PERMISSIONS.attendanceView, hidden: HIDDEN_FEATURES.attendance },
  { label: "Leave", href: "/leave", icon: CalendarDaysIcon, permission: PERMISSIONS.leaveView, hidden: HIDDEN_FEATURES.leave },
  { label: "Documents", href: "/documents", icon: FileTextIcon, permission: PERMISSIONS.documentsView, hidden: HIDDEN_FEATURES.documents },
  // Mail Inbox/Mailbox UI — DISABLED for this rollout, not removed. This is
  // the only link into /mail anywhere in the app (the mobile nav renders this
  // same list), so commenting this one line hides the whole mailbox surface.
  // The page, every component under features/mail/components/, and the
  // /api/v1/mail/* endpoints all stay intact — see app/(dashboard)/mail/page.tsx.
  //
  // NOT affected: Zoho connection management lives at /settings/mail (reached
  // from Settings, and from Recruitment's Scan Resumes dialog), which is a
  // separate route and stays fully working.
  //
  // TO RE-ENABLE: uncomment the line below and restore the render in
  // app/(dashboard)/mail/page.tsx.
  // { label: "Mail", href: "/mail", icon: MailIcon, permission: PERMISSIONS.mailView },
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
  { label: "Settings", href: "/settings", icon: SettingsIcon },
]

export const NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((item) => !item.hidden)
