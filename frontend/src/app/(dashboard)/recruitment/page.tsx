import { RecruitmentWorkspace } from "@/features/recruitment/components/recruitment-workspace"

export const metadata = {
  title: "Recruitment",
  description: "AI-powered recruitment intelligence, resume processing, and candidate matching.",
}

// `?jobOpeningId=<id>` opens Resumes filtered to that careers-website
// opening's applications — Job Administration links here.
// Next.js 16: searchParams is async — must be awaited.
export default async function RecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ jobOpeningId?: string }>
}) {
  const { jobOpeningId } = await searchParams
  return <RecruitmentWorkspace initialJobOpeningId={jobOpeningId} />
}
