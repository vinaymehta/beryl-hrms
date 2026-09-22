"use client"

import { Badge } from "@/components/ui/badge"
import {
  appraisalStatusMeta,
  appraisalStageMeta,
  appraisalLensMeta,
  CYCLE_STATUSES,
} from "@/features/appraisals/constants"
import type { AppraisalStatus, AppraisalStage, AppraisalLens, CycleStatus } from "@/types/appraisals"

export function AppraisalStatusBadge({ status }: { status: AppraisalStatus }) {
  const meta = appraisalStatusMeta(status)
  return <Badge className={meta.className}>{meta.label}</Badge>
}

/** The version chip: "V2 · Primary". Version number and stage always travel together. */
export function RevisionBadge({ stage, versionNumber }: { stage: AppraisalStage; versionNumber?: number }) {
  const meta = appraisalStageMeta(stage)
  return (
    <Badge className={meta.className}>
      {versionNumber != null && <span className="font-semibold">V{versionNumber}</span>}
      {versionNumber != null && " · "}
      {meta.shortLabel}
    </Badge>
  )
}

export function LensBadge({ lens }: { lens: AppraisalLens }) {
  const meta = appraisalLensMeta(lens)
  return <Badge className={meta.className}>{meta.label}</Badge>
}

export function CycleStatusBadge({ status }: { status: CycleStatus }) {
  const meta = CYCLE_STATUSES.find((s) => s.value === status) ?? CYCLE_STATUSES[0]
  return <Badge className={meta.className}>{meta.label}</Badge>
}
