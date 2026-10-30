import { JobOpeningEditor } from "@/features/job-openings/components/job-opening-editor"

export const metadata = { title: "Edit job opening" }

// Next.js 16: params is async — must be awaited.
export default async function EditJobOpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JobOpeningEditor id={Number(id)} />
}
