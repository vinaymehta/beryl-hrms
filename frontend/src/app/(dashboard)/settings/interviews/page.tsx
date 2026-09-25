import { redirect } from "next/navigation"

// The backend redirects here after Calendly OAuth
// (Calendly::ConnectionsController#callback), so the ROUTE must keep working
// exactly as it did. Calendly now lives in the full-screen All Settings
// window, under Integration — so this forwards there rather than being
// changed on the backend, which would break any authorization already in
// flight.
export default function SettingsInterviewsPage() {
  redirect("/all-settings?section=calendly")
}
