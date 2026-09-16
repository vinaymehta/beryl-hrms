import { redirect } from "next/navigation"

// Sessions are no longer a page of their own — they live in Account &
// Security alongside the password, which is where the reference design puts
// them and where people look for them. The route stays so existing links and
// bookmarks still land somewhere correct.
export default function SessionsPage() {
  redirect("/settings")
}
