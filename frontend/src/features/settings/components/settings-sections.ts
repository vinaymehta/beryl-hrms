import {
  Building2Icon,
  CalendarClockIcon,
  BadgeIcon,
  BriefcaseIcon,
  HashIcon,
  LockIcon,
  ReceiptIndianRupeeIcon,
  MailIcon,
  MonitorIcon,
  PlugIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react"

import { PERMISSIONS, type PermissionKey } from "@/constants/permissions"

export type SettingsSectionId =
  | "departments"
  | "job_titles"
  | "employment_types"
  | "calendly"
  | "mail"
  | "initial_id"
  | "company"
  | "salary_letter"
export type SettingsGroupId = "department" | "integration" | "other"

/**
 * Every settings area the app has, and which top-level tab it lives under.
 *
 * `href` is deliberately the existing route in each case rather than a new
 * one: /settings/interviews and /settings/mail are the redirect targets the
 * backend sends browsers back to after Calendly and Zoho OAuth
 * (Calendly::ConnectionsController#callback, Mail::ConnectionsController#callback),
 * so they have to keep working exactly as they are.
 */
export interface SettingsSection {
  id: SettingsSectionId
  group: SettingsGroupId
  label: string
  description: string
  href: string
  icon: LucideIcon
  /**
   * Who this section is for. Undefined means everyone — your own password and
   * sessions are not an administrative privilege.
   *
   * The backend already refuses the calls behind the others
   * (Calendly::ConnectionsController#authorize_manage!, ZohoConnectionPolicy,
   * CompanySettingPolicy), so this only stops offering someone a section that
   * would fail the moment they touched it.
   */
  permission?: PermissionKey | PermissionKey[]
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  // One page per list. Departments carries View, Edit and Delete on each
  // row, each shown only to somebody holding the permission behind it.
  {
    id: "departments",
    group: "department",
    label: "Departments",
    description: "View, edit and delete departments, with how many people are in each.",
    href: "/all-settings?section=departments",
    icon: Building2Icon,
    permission: PERMISSIONS.departmentsView,
  },
  {
    id: "job_titles",
    group: "department",
    label: "Job Titles",
    description: "The job titles offered on the employee form, each within a department.",
    href: "/all-settings?section=job_titles",
    icon: BadgeIcon,
    permission: PERMISSIONS.designationsView,
  },
  {
    id: "employment_types",
    group: "department",
    label: "Designations",
    description: "The designations offered on the employee form.",
    href: "/all-settings?section=employment_types",
    icon: BriefcaseIcon,
    permission: PERMISSIONS.employmentTypesView,
  },
  {
    id: "calendly",
    group: "integration",
    label: "Calendly",
    description: "Connect Calendly and choose the event type interviews are booked against.",
    href: "/settings/interviews",
    icon: CalendarClockIcon,
    permission: [PERMISSIONS.recruitmentView, PERMISSIONS.recruitmentManage],
  },
  {
    id: "mail",
    group: "integration",
    label: "Mail",
    description: "Connect a Zoho mailbox to read and search mail in this workspace.",
    href: "/settings/mail",
    icon: MailIcon,
    permission: PERMISSIONS.mailView,
  },
  {
    id: "initial_id",
    group: "other",
    label: "Initial ID",
    description: "Set the first employee ID. Every new employee is then numbered on from it.",
    href: "/settings?tab=other&section=initial_id",
    icon: HashIcon,
    permission: [PERMISSIONS.employeesManageRoles, PERMISSIONS.employeesCreate],
  },
  {
    id: "company",
    group: "other",
    label: "Company",
    description: "The company name, and whether work emails must use the company's domain.",
    href: "/all-settings?section=company",
    icon: Building2Icon,
    // The same key CompanySettingPolicy#update? checks.
    permission: PERMISSIONS.employeesManageRoles,
  },
  {
    id: "salary_letter",
    group: "other",
    label: "Salary structure & letter",
    description:
      "The legal name appraisal letters are issued for, and the rules that split a monthly gross into the letter's compensation table.",
    href: "/all-settings?section=salary_letter",
    icon: ReceiptIndianRupeeIcon,
    // Saved through the same company settings endpoint as Company.
    permission: PERMISSIONS.employeesManageRoles,
  },
]

/**
 * The three groups, in the order they are shown.
 *
 * `tint` is a complete literal class string per group, never assembled at
 * runtime — Tailwind's scanner only sees classes it can read in the source,
 * the same constraint the role and level badges work under.
 */
export const SETTINGS_GROUPS: {
  id: SettingsGroupId
  label: string
  description: string
  icon: LucideIcon
  tint: { header: string; icon: string }
}[] = [
  {
    id: "department",
    label: "Department",
    description: "Departments, job titles and designations.",
    icon: Building2Icon,
    tint: { header: "bg-emerald-500/8", icon: "bg-emerald-500/15 text-emerald-600" },
  },
  {
    id: "integration",
    label: "Integration",
    description: "Connect the outside services this workspace talks to.",
    icon: PlugIcon,
    tint: { header: "bg-sky-500/8", icon: "bg-sky-500/15 text-sky-600" },
  },
  {
    id: "other",
    label: "Other",
    description: "How this workspace numbers its people, the company itself, and its appraisal letters.",
    icon: SlidersHorizontalIcon,
    tint: { header: "bg-amber-500/8", icon: "bg-amber-500/15 text-amber-600" },
  },
]

/**
 * The sidebar's Settings page, which is NOT part of All Settings: it belongs
 * to the person rather than the workspace. Two tabs — your password, and the
 * devices you are signed in on.
 */
export type PersonalSettingsTab = "account" | "sessions"

export const PERSONAL_SETTINGS_TABS: {
  id: PersonalSettingsTab
  label: string
  description: string
  icon: LucideIcon
}[] = [
  {
    id: "account",
    label: "Account",
    description: "Change the password you sign in with.",
    icon: LockIcon,
  },
  {
    id: "sessions",
    label: "Sessions",
    description: "Everywhere you are signed in. Revoke any device you don't recognise.",
    icon: MonitorIcon,
  },
]

export function settingsSection(id: SettingsSectionId) {
  return SETTINGS_SECTIONS.find((s) => s.id === id)!
}

export function sectionsInGroup(group: SettingsGroupId) {
  return SETTINGS_SECTIONS.filter((s) => s.group === group)
}

/**
 * Which tab a section belongs to. The OAuth callbacks land on /settings/mail
 * and /settings/interviews directly, so the page has to work out for itself
 * which tab to open rather than being told by the URL.
 */
export function groupForSection(id: SettingsSectionId): SettingsGroupId {
  return settingsSection(id).group
}
