import { AllSettingsWorkspace } from "@/features/settings/components/all-settings-workspace"

export const metadata = { title: "All Settings" }

// Under (dashboard), so it renders inside the shell like any other page and
// inherits the authentication and forced-password-change gates. Admin only —
// see AllSettingsWorkspace.
//
// Next.js 16: searchParams is async — must be awaited, no synchronous access.
export default async function AllSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>
}) {
  const { section } = await searchParams
  const known = [
    "departments",
    "job_titles",
    "employment_types",
    "calendly",
    "mail",
    "initial_id",
    "company",
    "salary_letter",
  ] as const
  const initial = known.find((id) => id === section)

  return <AllSettingsWorkspace initialSection={initial} />
}
