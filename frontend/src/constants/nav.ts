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
  SettingsIcon,
} from "lucide-react"

import { PERMISSIONS, type PermissionKey } from "@/constants/permissions"
import { HIDDEN_FEATURES } from "@/constants/feature-flags"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Omit for items every authenticated user can see (Dashboard, Settings). */
  permission?: PermissionKey
}

const ALL_NAV_ITEMS: (NavItem & { hidden?: boolean })[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { label: "Employees", href: "/employees", icon: UsersIcon, permission: PERMISSIONS.employeesView },
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
  { label: "Recruitment", href: "/recruitment", icon: BriefcaseIcon, permission: PERMISSIONS.recruitmentView },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
]

export const NAV_ITEMS: NavItem[] = ALL_NAV_ITEMS.filter((item) => !item.hidden)
