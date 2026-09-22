import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { AppraisalsWorkspace } from "@/features/appraisals/components/appraisals-workspace"

/**
 * The workspace reads its active tab from `?tab=`, so it sits behind a Suspense
 * boundary — useSearchParams otherwise opts the whole tree above it into
 * client-side rendering.
 */
export default function AppraisalsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <AppraisalsWorkspace />
    </Suspense>
  )
}
