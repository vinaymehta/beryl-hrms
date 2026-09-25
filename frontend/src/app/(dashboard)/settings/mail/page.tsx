import { redirect } from "next/navigation"

// The backend redirects here after Zoho OAuth
// (Mail::ConnectionsController#callback) — see the note in the Calendly
// equivalent. Mail lives under Integration in All Settings now.
export default function SettingsMailPage() {
  redirect("/all-settings?section=mail")
}
