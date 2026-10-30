import { JobOpeningDetail } from "@/features/job-openings/components/job-opening-detail"

export const metadata = { title: "Job opening" }

// One opening, read-only — the list's rows open here. Next.js 16: params is async.
export default async function JobOpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <JobOpeningDetail id={Number(id)} />
}
