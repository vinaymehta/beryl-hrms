import { SettingsDialog } from "@/features/settings/components/settings-dialog"

export const metadata = { title: "Mail · Settings" }

// Route kept exactly as it was: the backend redirects here after Zoho OAuth
// (Mail::ConnectionsController#callback). It now opens the Settings modal with
// the Mail section already selected.
export default function SettingsMailPage() {
  return <SettingsDialog initialSection="mail" />
}
