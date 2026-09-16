import { CalendarClockIcon, LockIcon, MailIcon, type LucideIcon } from "lucide-react"

import { PERMISSIONS, type PermissionKey } from "@/constants/permissions"

export type SettingsSectionId = "account" | "calendly" | "mail"

/**
 * Every settings area the app actually has, in the order they're shown.
 *
 * `href` is deliberately the existing route in each case rather than a new
 * one: /settings/interviews and /settings/mail are the redirect targets the
 * backend sends browsers back to after Calendly and Zoho OAuth
 * (Calendly::ConnectionsController#callback, Mail::ConnectionsController#callback),
 * so they have to keep working exactly as they are.
 */
export const SETTINGS_SECTIONS: {
  id: SettingsSectionId
  label: string
  caption: string
  description: string
  href: string
  icon: LucideIcon
  /**
   * Who this section is for. Undefined means everyone — your own password and
   * sessions are not an administrative privilege.
   *
   * The backend already refuses the calls behind the other two
   * (Calendly::ConnectionsController#authorize_manage!, ZohoConnectionPolicy),
   * so this only stops offering someone a section that would fail the moment
   * they touched it.
   */
  permission?: PermissionKey | PermissionKey[]
}[] = [
  {
    id: "account",
    label: "Account & Security",
    caption: "Password, sessions, devices",
    description: "Manage your password and active sessions.",
    href: "/settings",
    icon: LockIcon,
  },
  {
    id: "calendly",
    label: "Calendly",
    caption: "Manage Calendly connection",
    description: "Connect Calendly and choose the event type interviews are booked against.",
    href: "/settings/interviews",
    icon: CalendarClockIcon,
    permission: [PERMISSIONS.recruitmentView, PERMISSIONS.recruitmentManage],
  },
  {
    id: "mail",
    label: "Mail",
    caption: "Zoho Mail configuration",
    description: "Connect a Zoho mailbox to read and search mail in this workspace.",
    href: "/settings/mail",
    icon: MailIcon,
    permission: PERMISSIONS.mailView,
  },
]

export function settingsSection(id: SettingsSectionId) {
  return SETTINGS_SECTIONS.find((s) => s.id === id)!
}
