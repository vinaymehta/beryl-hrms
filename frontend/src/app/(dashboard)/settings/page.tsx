import { SettingsDialog } from "@/features/settings/components/settings-dialog"

export const metadata = { title: "Settings" }

// Settings is a full page in the dashboard shell, never a modal. It opens on
// the three top-level tabs — Department, Integration, Other — with no left
// navigation; choosing one turns this same page into the two-column layout.
// See SettingsView.
//
// No initialSection: landing straight in a section would skip the tabs, which
// are the whole point of the layout now that there are five sections across
// three unrelated concerns.
export default function SettingsPage() {
  return <SettingsDialog />
}
