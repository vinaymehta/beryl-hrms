"use client"

import { ArrowLeftIcon, CalendarDaysIcon, GaugeIcon, MessageSquareIcon, HistoryIcon, NetworkIcon, PencilLineIcon, ShieldIcon, UsersRoundIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { AppraisalStatusBadge } from "@/features/appraisals/components/appraisal-badges"
import { AppraisalWorkflowTimeline } from "@/features/appraisals/components/appraisal-workflow-timeline"
import { RevisionHistory } from "@/features/appraisals/components/revision-history"
import { AppraisalComments } from "@/features/appraisals/components/appraisal-comments"
import { AppraisalActions } from "@/features/appraisals/components/appraisal-actions"
import { RevisionForm } from "@/features/appraisals/components/revision-form"
import { SelfAppraisalWizard } from "@/features/appraisals/components/self-appraisal-wizard"
import { CompensationPanel } from "@/features/appraisals/components/compensation-panel"
import { FeedbackRequestsPanel } from "@/features/appraisals/components/feedback-requests-panel"
import { useAppraisal } from "@/features/appraisals/hooks/use-appraisals"
import { useSubmitReview } from "@/features/appraisals/hooks/use-appraisal-mutations"
import { appraisalStageMeta } from "@/features/appraisals/constants"
import type { AppraisalDetail as AppraisalDetailType } from "@/types/appraisals"
import type { LucideIcon } from "lucide-react"

function Section({
  icon: Icon,
  title,
  action,
  className,
  children,
}: {
  icon: LucideIcon
  title: string
  action?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-role-hr/12 text-role-hr">
            <Icon className="size-3.5" />
          </span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

function Deadline({ label, date }: { label: string; date: string | null }) {
  return (
    <div className="grid gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{date ? new Date(date).toLocaleDateString() : "—"}</p>
    </div>
  )
}

/** The reviewer chain, read from the snapshot taken when the cycle started. */
function ManagerChain({ appraisal }: { appraisal: AppraisalDetailType }) {
  const rows: { label: string; name: string | null; active: boolean }[] = [
    { label: "Primary", name: appraisal.managers.primary?.fullName ?? null, active: appraisal.status === "primary_review" },
    { label: "Secondary", name: appraisal.managers.secondary?.fullName ?? null, active: appraisal.status === "secondary_review" },
    { label: "Final", name: appraisal.managers.final?.fullName ?? null, active: appraisal.status === "final_review" },
  ].filter((row) => row.label !== "Secondary" || appraisal.secondaryReviewApplicable)

  return (
    <ul className="grid gap-2">
      {rows.map((row) => (
        <li
          key={row.label}
          className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 ${row.active ? "border-role-hr bg-role-hr/5" : ""}`}
        >
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{row.label} manager</p>
            <p className="truncate text-sm font-medium">{row.name ?? "Not assigned"}</p>
          </div>
          {row.active && <Badge className="bg-role-hr/15 text-role-hr">Reviewing</Badge>}
        </li>
      ))}
    </ul>
  )
}

export function AppraisalDetail({ appraisalId, onBack }: { appraisalId: string; onBack?: () => void }) {
  const { data: appraisal, isLoading, isError, refetch } = useAppraisal(appraisalId)
  const submitReview = useSubmitReview(appraisalId)

  if (isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-64 w-full rounded-2xl lg:col-span-2" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    )
  }

  if (isError || !appraisal) {
    return (
      <div className="grid gap-3 rounded-xl border border-dashed p-10 text-center">
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

  const { viewer } = appraisal
  // A reviewer writes against the employee's own V1; an employee writes against
  // nothing, because there is nothing they may compare with yet.
  const reference = appraisal.revisions.find((r) => r.stage === "self_appraisal")
  const stageMeta = viewer.canSubmitReview ? appraisalStageMeta(appraisal.status as never) : null

  return (
    <div className="grid gap-4">
      <Card className="overflow-hidden border-none bg-gradient-to-br from-role-hr to-role-hr/70 text-white">
        <CardContent className="flex flex-wrap items-center gap-4 p-5">
          {onBack && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back"
              className="text-white hover:bg-white/15 hover:text-white"
              onClick={onBack}
            >
              <ArrowLeftIcon className="size-4" />
            </Button>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-semibold">{appraisal.employeeName}</h1>
            <p className="truncate text-sm text-white/80">
              {appraisal.cycleName} · {appraisal.template.name} v{appraisal.template.version}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <AppraisalStatusBadge status={appraisal.status} />
              {viewer.level && (
                <Badge className="border border-white/25 bg-white/15 text-white">
                  You are the {viewer.level} manager
                </Badge>
              )}
              {viewer.isSubject && (
                <Badge className="border border-white/25 bg-white/15 text-white">Your appraisal</Badge>
              )}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-2xl leading-tight font-semibold tabular-nums">
              {appraisal.effectiveScore ? Number(appraisal.effectiveScore).toFixed(2) : "—"}
            </p>
            {/* The employee's own V1 score is never the official one, so before a
                manager has reviewed there is deliberately nothing to show here. */}
            <p className="text-xs text-white/75">
              {appraisal.effectiveScore == null
                ? "Awaiting manager review"
                : appraisal.finalScore && appraisal.finalScore !== appraisal.calculatedScore
                  ? `Calibrated · calculated ${Number(appraisal.calculatedScore).toFixed(2)}`
                  : "Weighted score"}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* The write surface, shown only to whoever's move it actually is.
          The employee gets a step-by-step wizard that saves as they go; a
          reviewer gets the single-page form, because they work with the
          self-appraisal open beside them and splitting that across steps would
          only break the comparison. */}
      {viewer.canSubmitSelf && (
        <Section icon={PencilLineIcon} title="Your self-appraisal">
          <SelfAppraisalWizard appraisal={appraisal} />
        </Section>
      )}

      {viewer.canSubmitReview && (
        <Section icon={PencilLineIcon} title={`Your review — ${stageMeta?.label ?? ""}`}>
          <RevisionForm
            appraisal={appraisal}
            reference={reference}
            submitLabel="Submit review"
            isPending={submitReview.isPending}
            onSubmit={(payload) => submitReview.mutate({ ...payload.narrative, answers: payload.answers })}
          />
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="grid gap-4 lg:col-span-2">
          <Section icon={HistoryIcon} title="Version history">
            <RevisionHistory appraisal={appraisal} />
          </Section>

          <Section icon={MessageSquareIcon} title="Comments">
            <AppraisalComments appraisal={appraisal} />
          </Section>

          {/* §21 — optional, and never a gate on the workflow. Renders nothing
              for a viewer who can neither request nor answer. */}
          <Section icon={UsersRoundIcon} title="Additional feedback">
            <FeedbackRequestsPanel appraisal={appraisal} />
          </Section>
        </div>

        <div className="grid gap-4">
          <Section icon={GaugeIcon} title="Workflow">
            <AppraisalWorkflowTimeline
              status={appraisal.status}
              secondaryApplicable={appraisal.secondaryReviewApplicable}
              transitions={appraisal.transitions}
            />
          </Section>

          <Section icon={NetworkIcon} title="Reviewers">
            <ManagerChain appraisal={appraisal} />
          </Section>

          <Section icon={CalendarDaysIcon} title="Deadlines">
            <div className="grid grid-cols-2 gap-4">
              <Deadline label="Self-appraisal" date={appraisal.cycle.employeeSubmissionDeadline} />
              <Deadline label="Primary review" date={appraisal.cycle.primaryReviewDeadline} />
              {appraisal.secondaryReviewApplicable && (
                <Deadline label="Secondary review" date={appraisal.cycle.secondaryReviewDeadline} />
              )}
              <Deadline label="Finalization" date={appraisal.cycle.finalizationDeadline} />
            </div>
          </Section>

          {appraisal.scoreOverrides.length > 0 && (
            <Section icon={GaugeIcon} title="Calibration history">
              <ul className="grid gap-2">
                {appraisal.scoreOverrides.map((override) => (
                  <li key={override.id} className="grid gap-0.5 rounded-lg border p-2.5">
                    <p className="text-sm font-medium tabular-nums">
                      {override.previousScore ? Number(override.previousScore).toFixed(2) : "—"} →{" "}
                      {Number(override.newScore).toFixed(2)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {override.actorName} · {new Date(override.createdAt).toLocaleDateString()}
                    </p>
                    <p className="text-xs">{override.reason}</p>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {/* Restricted: the server omits the compensation block entirely
              unless the viewer holds appraisals.manage_compensation, so this
              section simply never renders for anyone else. */}
          {appraisal.viewer.canManageCompensation && (
            <Section icon={ShieldIcon} title="Compensation & promotion">
              <CompensationPanel appraisal={appraisal} />
            </Section>
          )}
        </div>
      </div>

      <AppraisalActions appraisal={appraisal} />
    </div>
  )
}
