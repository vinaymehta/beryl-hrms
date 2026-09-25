import { redirect } from "next/navigation"

// Departments moved into All Settings, so there is one door to it rather than
// two. The route stays and redirects, because bookmarks and any link written
// before the move should still land somewhere correct rather than 404.
export default function DepartmentsPage() {
  redirect("/all-settings?section=departments")
}
