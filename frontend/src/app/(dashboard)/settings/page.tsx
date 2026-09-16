import { SettingsDialog } from "@/features/settings/components/settings-dialog"

export const metadata = { title: "Settings" }

// Settings opens as a modal over the dashboard shell — the sidebar and topbar
// stay visible behind it. Account & Security is the landing section rather
// than a separate overview screen: an overview whose only content is links to
// the nav sitting right beside it would be a view that says nothing.
export default function SettingsPage() {
  return <SettingsDialog initialSection="account" />
}
