import { MailWorkspace } from "@/features/mail/components/mail-workspace"

export const metadata = { title: "Mail" }

export default function MailPage() {
  return (
    <div className="grid gap-4">
      <h1 className="text-2xl font-semibold tracking-tight">Mail</h1>
      <MailWorkspace />
    </div>
  )
}
