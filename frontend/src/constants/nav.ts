import type { LucideIcon } from "lucide-react"
import {
  LayoutDashboardIcon,
  UsersIcon,
  Building2Icon,
  ClockIcon,
  CalendarDaysIcon,
  FileTextIcon,
  MailIcon,
  BriefcaseIcon,
  SettingsIcon,
} from "lucide-react"

import { PERMISSIONS, type PermissionKey } from "@/constants/permissions"

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  /** Omit for items every authenticated user can see (Dashboard, Settings). */
  permission?: PermissionKey
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { label: "Employees", href: "/employees", icon: UsersIcon, permission: PERMISSIONS.employeesView },
  { label: "Departments", href: "/departments", icon: Building2Icon, permission: PERMISSIONS.departmentsView },
  { label: "Attendance", href: "/attendance", icon: ClockIcon, permission: PERMISSIONS.attendanceView },
  { label: "Leave", href: "/leave", icon: CalendarDaysIcon, permission: PERMISSIONS.leaveView },
  { label: "Documents", href: "/documents", icon: FileTextIcon, permission: PERMISSIONS.documentsView },
  { label: "Mail", href: "/mail", icon: MailIcon, permission: PERMISSIONS.mailView },
  { label: "Recruitment", href: "/recruitment", icon: BriefcaseIcon, permission: PERMISSIONS.recruitmentView },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
]
