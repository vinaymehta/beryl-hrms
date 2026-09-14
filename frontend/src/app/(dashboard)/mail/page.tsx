import { redirect } from "next/navigation"

// ---------------------------------------------------------------------------
// Mail Inbox/Mailbox UI — DISABLED for this rollout, not removed.
//
// The whole mailbox surface (message list, folders, reading pane, compose,
// search, date filter, unread/count badges) is commented out below. Nothing
// was deleted: MailWorkspace and every component it uses are still in
// frontend/src/features/mail/components/, and the backend's /api/v1/mail/*
// endpoints are untouched and still functional.
//
// Why the render is commented out rather than just hidden behind a redirect:
// mounting MailWorkspace starts the mailbox POLLING loop (see
// features/mail/hooks/use-mail-messages.ts — `refetchInterval`), which would
// keep calling Zoho on a timer for a page nobody is meant to be on. Not
// rendering it is what actually stops that traffic.
//
// Deliberately still working, do not confuse with this:
//   * Zoho OAuth + connection management -> /settings/mail
//     (features/mail/components/mail-connections-settings.tsx)
//   * The automatic new-mail resume scanner -> backend ZohoAutoScanJob (cron)
//   * Recruitment -> Scan Resumes + its date range -> scan-zoho-modal.tsx,
//     which imports features/mail/api.ts. That module MUST stay live.
//
// TO RE-ENABLE: delete the `redirect("/")` line, uncomment the import and the
// return below, and uncomment the "Mail" entry in constants/nav.ts.
// ---------------------------------------------------------------------------

// import { MailWorkspace } from "@/features/mail/components/mail-workspace"

export const metadata = { title: "Mail" }

export default function MailPage() {
  // Direct navigation to /mail bounces to the dashboard rather than painting
  // an empty page — same treatment the other rolled-back sections get
  // (attendance/leave/documents, see constants/feature-flags.ts).
  redirect("/")

  // return <MailWorkspace />
}
