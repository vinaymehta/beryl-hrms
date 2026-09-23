"use client"

import { ArrowLeftIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AppraisalActions } from "@/features/appraisals/components/appraisal-actions"
import { AppraisalWorkspace } from "@/features/appraisals/components/appraisal-workspace"
import { useAppraisal } from "@/features/appraisals/hooks/use-appraisals"
import type { AppraisalDetail as AppraisalDetailType } from "@/types/appraisals"
import type { LucideIcon } from "lucide-react"

/** The reviewer chain, read from the snapshot taken when the cycle started. */
/**
 * The appraisal page: a compact header, a tab bar, and one panel at a time.
 *
 * Everything below the shell lives in AppraisalWorkspace, which both the
 * employee and every reviewer share — the two used to be a five-step wizard
 * and a single long scroll respectively, which made the same appraisal look
 * like two different products.
 *
 * Capped at 1400px. Wider than that and a line of evidence text runs further
 * than the eye tracks comfortably.
 */
export function AppraisalDetail({ appraisalId, onBack }: { appraisalId: string; onBack?: () => void }) {
  const { data: appraisal, isLoading, isError, refetch } = useAppraisal(appraisalId)

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-[1400px] gap-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-full rounded-lg" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    )
  }

  if (isError || !appraisal) {
    return (
      <div className="mx-auto grid w-full max-w-[1400px] gap-3 rounded-xl border border-dashed p-10 text-center">
        <p className="text-sm font-semibold text-foreground">Couldn&apos;t load this appraisal</p>
        <p className="text-xs text-muted-foreground">It may not exist, or you may not have access to it.</p>
        <div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto grid w-full max-w-[1400px] gap-4">
      {onBack && (
        <div>
          <Button variant="ghost" size="sm" className="-ml-2 gap-1.5 text-muted-foreground" onClick={onBack}>
            <ArrowLeftIcon className="size-4" /> Back to appraisals
          </Button>
        </div>
      )}

      <AppraisalWorkspace appraisal={appraisal} />

      <AppraisalActions appraisal={appraisal} />
    </div>
  )
}
