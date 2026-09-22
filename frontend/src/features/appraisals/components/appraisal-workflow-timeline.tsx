"use client"

import { CheckIcon } from "lucide-react"
import { cn } from "cn"

import { APPRAISAL_STATUSES, appraisalStatusMeta } from "@/features/appraisals/constants"
import type { AppraisalStatus, AppraisalTransition } from "@/types/appraisals"

/**
 * The workflow as a progress rail, plus the real audit trail beneath it.
 *
 * The rail shows the CANONICAL path; `secondary_review` is dropped when this
 * appraisal doesn't run one, so an employee whose cycle has no secondary step
 * never sees a stage that will never happen.
 */
export function AppraisalWorkflowTimeline({
  status,
  secondaryApplicable,
  transitions,
}: {
  status: AppraisalStatus
  secondaryApplicable: boolean
  transitions: AppraisalTransition[]
}) {
  const path = APPRAISAL_STATUSES.filter((s) => s.value !== "draft").filter(
    (s) => secondaryApplicable || s.value !== "secondary_review"
  )
  const currentIndex = path.findIndex((s) => s.value === status)

  return (
    <div className="grid gap-5">
      <ol className="grid gap-0">
        {path.map((step, index) => {
          const done = currentIndex > index
          const current = currentIndex === index
          const isLast = index === path.length - 1

          return (
            <li key={step.value} className="relative flex gap-3 pb-4 last:pb-0">
              {!isLast && (
                <span
                  aria-hidden
                  className={cn("absolute top-5 bottom-0 left-[9px] w-px", done ? "bg-success/50" : "bg-border")}
                />
              )}
              <span
                aria-hidden
                className={cn(
                  "z-10 mt-0.5 flex size-[19px] shrink-0 items-center justify-center rounded-full border-2 bg-card",
                  done && "border-success bg-success text-success-foreground",
                  current && "border-role-hr bg-role-hr text-role-hr-foreground",
                  !done && !current && "border-border"
                )}
              >
                {done && <CheckIcon className="size-2.5" />}
                {current && <span className="size-1.5 rounded-full bg-current" />}
              </span>
              <div className="min-w-0 pt-px">
                <p
                  className={cn(
                    "text-sm leading-tight",
                    current ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                {current && step.owner && (
                  <p className="text-xs text-muted-foreground">Waiting on the {step.owner}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {transitions.length > 0 && (
        <div className="grid gap-2 border-t pt-4">
          <p className="text-xs font-semibold text-muted-foreground">History</p>
          <ul className="grid gap-1.5">
            {[...transitions].reverse().map((transition) => (
              <li key={transition.id} className="flex flex-wrap items-baseline gap-x-1.5 text-xs">
                <span className="font-medium text-foreground">
                  {appraisalStatusMeta(transition.toStatus).label}
                </span>
                <span className="text-muted-foreground">
                  by {transition.actorName ?? "system"} ·{" "}
                  {new Date(transition.createdAt).toLocaleDateString()}
                </span>
                {transition.notes && (
                  <span className="w-full text-muted-foreground italic">“{transition.notes}”</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
