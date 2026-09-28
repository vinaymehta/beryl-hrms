import { redirect } from "next/navigation"

// Sessions are a tab of the Settings page, not a page of their own. The route
// stays so existing links and bookmarks still land on that tab.
export default function SessionsPage() {
  redirect("/settings?tab=sessions")
}
