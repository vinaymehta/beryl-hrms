import { SettingsDialog } from "@/features/settings/components/settings-dialog"

export const metadata = { title: "Calendly · Settings" }

// Route kept exactly as it was: the backend redirects here after Calendly
// OAuth (Calendly::ConnectionsController#callback). It now opens the Settings
// modal with the Calendly section already selected.
export default function SettingsInterviewsPage() {
  return <SettingsDialog initialSection="calendly" />
}
