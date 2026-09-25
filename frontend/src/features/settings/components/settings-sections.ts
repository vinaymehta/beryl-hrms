import {
  Building2Icon,
  CalendarClockIcon,
  EyeIcon,
  PencilIcon,
  Trash2Icon,
  HashIcon,
  LockIcon,
  MailIcon,
  PlugIcon,
  SlidersHorizontalIcon,
  type LucideIcon,
} from "lucide-react"

import { PERMISSIONS, type PermissionKey } from "@/constants/permissions"

export type SettingsSectionId =
  | "departments_view"
  | "departments_edit"
  | "departments_delete"
  | "calendly"
  | "mail"
  | "initial_id"
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
  // Three pages rather than one page with a mode picker, so Department reads
  // exactly like Integration does — a flat list on the landing screen, the
  // same list under a collapsible group in the left navigation. Gating each
  // on its own permission also means somebody who may edit but not delete is
  // never shown the option at all, rather than shown it and refused.
  {
    id: "departments_view",
    group: "department",
    label: "View",
    description: "Every department, with how many people are in it.",
    href: "/all-settings?section=departments_view",
    icon: EyeIcon,
    permission: PERMISSIONS.departmentsView,
  },
  {
    id: "departments_edit",
    group: "department",
    label: "Edit",
    description: "Rename a department or change what it is for.",
    href: "/all-settings?section=departments_edit",
    icon: PencilIcon,
    permission: PERMISSIONS.departmentsUpdate,
  },
  {
    id: "departments_delete",
    group: "department",
    label: "Delete",
    description: "Remove departments, one at a time or several together.",
    href: "/all-settings?section=departments_delete",
    icon: Trash2Icon,
    permission: PERMISSIONS.departmentsDelete,
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
    description: "Departments and the designations that sit inside them.",
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
    description: "How this workspace numbers its people.",
    icon: SlidersHorizontalIcon,
    tint: { header: "bg-amber-500/8", icon: "bg-amber-500/15 text-amber-600" },
  },
]

/**
 * Account & Security, which is NOT part of All Settings.
 *
 * It is the one page that belongs to the person rather than to the workspace,
 * and it stays where it always was — the Settings entry in the application
 * sidebar. Keeping it out of the administrative window is the whole point of
 * the split: an employee changing their password should not be looking at
 * department management to do it.
 */
export const ACCOUNT_SECTION = {
  id: "account" as const,
  label: "Account & Security",
  description: "Manage your password and active sessions.",
  href: "/settings",
  icon: LockIcon,
}

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
