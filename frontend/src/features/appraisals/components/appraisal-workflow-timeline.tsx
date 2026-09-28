"use client"

import { CheckIcon } from "lucide-react"
import { cn } from "cn"

import { appraisalStatusMeta } from "@/features/appraisals/constants"
import type { AppraisalStatus, AppraisalTransition } from "@/types/appraisals"

/**
 * The workflow as a progress rail, plus the real audit trail beneath it.
 *
 * The rail is THIS appraisal's path: self-appraisal, then one step per manager
 * in its reviewer chain (level 1 first), then Admin/HR's Final review,
 * discussion, release and acknowledgement. Compensation approval is withdrawn
 * from the workflow and drawn only for an old appraisal sitting in it.
 */
type Step = { key: string; label: string; waitingOn: string | null }

const TAIL: AppraisalStatus[] = ["final_review", "appraisal_discussion", "released", "employee_acknowledged", "closed"]

export function AppraisalWorkflowTimeline({
  status,
  reviewLevel,
  reviewerNames,
  transitions,
}: {
  status: AppraisalStatus
  reviewLevel: number | null
  reviewerNames: string[]
  transitions: AppraisalTransition[]
}) {
  const path: Step[] = [
    { key: "self_appraisal_open", label: "Self-appraisal open", waitingOn: "the employee" },
    { key: "employee_submitted", label: "Submitted", waitingOn: null },
    ...reviewerNames.map((name, index) => ({
      key: `manager_review:${index + 1}`,
      label: `Level ${index + 1} manager review`,
      waitingOn: name,
    })),
    ...(status === "compensation_approval"
      ? [{ key: "compensation_approval", label: "Compensation approval", waitingOn: "HR" }]
      : []),
    ...TAIL.map((value) => ({
      key: value,
      label: appraisalStatusMeta(value).label,
      waitingOn:
        value === "final_review" || value === "appraisal_discussion"
          ? "Admin / HR"
          : value === "released"
            ? "the employee to acknowledge"
            : null,
    })),
  ]
  const currentKey = status === "manager_review" ? `manager_review:${reviewLevel}` : status
  const currentIndex = path.findIndex((step) => step.key === currentKey)

  return (
    <div className="grid gap-5">
      <ol className="grid gap-0">
        {path.map((step, index) => {
          const done = currentIndex > index
          const current = currentIndex === index
          const isLast = index === path.length - 1

          return (
            <li key={step.key} className="relative flex gap-3 pb-4 last:pb-0">
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
                {current && step.waitingOn && (
                  <p className="text-xs text-muted-foreground">Waiting on {step.waitingOn}</p>
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
                  {transition.toStatus === "manager_review" && transition.notes
                    ? transition.notes
                    : appraisalStatusMeta(transition.toStatus).label}
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
