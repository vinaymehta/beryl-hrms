import { AllSettingsWorkspace } from "@/features/settings/components/all-settings-workspace"

export const metadata = { title: "All Settings" }

// Under (dashboard) on purpose, though it covers the shell entirely: that is
// what gives it the authentication gate and the forced-password-change gate
// without re-implementing either. See AllSettingsWorkspace.
//
// Next.js 16: searchParams is async — must be awaited, no synchronous access.
export default async function AllSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  const { section } = await searchParams
  const known = [
    "departments_view",
    "departments_edit",
    "departments_delete",
    "calendly",
    "mail",
    "initial_id",
  ] as const
  const initial = known.find((id) => id === section)

  return <AllSettingsWorkspace initialSection={initial} />
}
