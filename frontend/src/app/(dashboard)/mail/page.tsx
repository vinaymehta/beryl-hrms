import { MailWorkspace } from "@/features/mail/components/mail-workspace"

export const metadata = { title: "Mail" }

// The mailbox of a connected Zoho account — message list, folders, reading
// pane, compose and search, with a picker when several accounts are
// connected. Connections are managed at /settings/mail.
export default function MailPage() {
  return <MailWorkspace />
}
