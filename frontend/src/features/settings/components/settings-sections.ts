import { CalendarClockIcon, LockIcon, MailIcon, type LucideIcon } from "lucide-react"

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
  },
  {
    id: "mail",
    label: "Mail",
    caption: "Zoho Mail configuration",
    description: "Connect a Zoho mailbox to read and search mail in this workspace.",
    href: "/settings/mail",
    icon: MailIcon,
  },
]

export function settingsSection(id: SettingsSectionId) {
  return SETTINGS_SECTIONS.find((s) => s.id === id)!
}
