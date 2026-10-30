import { InterviewsTabs } from "@/features/recruitment/components/interviews-page"

export const metadata = { title: "Interviews" }

// Every interview in the company and its feedback for Recruitment access
// (CandidatePolicy#index? on the API), plus the signed-in user's own
// interviews. `?tab=mine` is the link the feedback-request email uses.
// Next.js 16: searchParams is async — must be awaited.
export default async function InterviewsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams
  return <InterviewsTabs initialTab={tab === "mine" ? "mine" : "all"} />
}
