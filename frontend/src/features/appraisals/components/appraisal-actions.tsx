"use client"

import { useState } from "react"
import { CheckCircle2Icon, SendIcon, UndoIcon, SlidersHorizontalIcon, BadgeCheckIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/components/ui/dialog"
import {
  useAdvanceAppraisal,
  useReturnForCorrection,
  useOverrideScore,
  useReleaseAppraisal,
  useAcknowledgeAppraisal,
} from "@/features/appraisals/hooks/use-appraisal-mutations"
import type { AppraisalDetail } from "@/types/appraisals"

/**
 * The action bar. Every button is gated on the `viewer` block the server sent,
 * so the UI offers exactly what the API would accept and nothing more — the
 * decision is made once, on the backend, and read here.
 *
 * Deliberately manual: these move the workflow and notify the next person, they
 * never decide a review on anyone's behalf.
 */
export function AppraisalActions({ appraisal }: { appraisal: AppraisalDetail }) {
  const { viewer, status } = appraisal
  const [returnOpen, setReturnOpen] = useState(false)
  const [returnNote, setReturnNote] = useState("")
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [overrideScore, setOverrideScoreValue] = useState("")
  const [overrideReason, setOverrideReason] = useState("")
  const [ackOpen, setAckOpen] = useState(false)
  const [ackNote, setAckNote] = useState("")

  const advance = useAdvanceAppraisal(appraisal.id)
  const returnForCorrection = useReturnForCorrection(appraisal.id)
  const override = useOverrideScore(appraisal.id)
  const release = useReleaseAppraisal(appraisal.id)
  const acknowledge = useAcknowledgeAppraisal(appraisal.id)

  const canMoveToCompensation = viewer.canAdvance && status === "appraisal_discussion"
  const canClose = viewer.isAdministrator && status === "employee_acknowledged"
  const anyAction =
    viewer.canReturnForCorrection ||
    viewer.canOverrideScore ||
    viewer.canRelease ||
    viewer.canAcknowledge ||
    canMoveToCompensation ||
    canClose

  if (!anyAction) return null

  return (
    <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-background p-3 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
      {viewer.canReturnForCorrection && status !== "self_appraisal_open" && (
        <Button variant="outline" className="gap-1.5" onClick={() => setReturnOpen(true)}>
          <UndoIcon className="size-4" /> Return for correction
        </Button>
      )}

      {viewer.canOverrideScore && (
        <Button variant="outline" className="gap-1.5" onClick={() => setOverrideOpen(true)}>
          <SlidersHorizontalIcon className="size-4" /> Calibrate score
        </Button>
      )}

      {canMoveToCompensation && (
        <Button
          variant="outline"
          className="gap-1.5"
          disabled={advance.isPending}
          onClick={() => advance.mutate({ to: "compensation_approval" })}
        >
          <BadgeCheckIcon className="size-4" /> Send to compensation
        </Button>
      )}

      {viewer.canRelease && (status === "appraisal_discussion" || status === "compensation_approval") && (
        <Button
          className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
          disabled={release.isPending}
          onClick={() => release.mutate(undefined)}
        >
          <SendIcon className="size-4" /> {release.isPending ? "Releasing…" : "Release to employee"}
        </Button>
      )}

      {viewer.canAcknowledge && (
        <Button
          className="gap-1.5 bg-success text-success-foreground shadow-2xs hover:bg-success/90"
          onClick={() => setAckOpen(true)}
        >
          <CheckCircle2Icon className="size-4" /> Acknowledge
        </Button>
      )}

      {canClose && (
        <Button variant="outline" disabled={advance.isPending} onClick={() => advance.mutate({ to: "closed" })}>
          Close appraisal
        </Button>
      )}

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return for correction</DialogTitle>
            <DialogDescription>
              This reopens the self-appraisal. Nothing already submitted is deleted — the next submission becomes
              a new version alongside the existing ones.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="return-note">What needs changing?</Label>
            <textarea
              id="return-note"
              rows={3}
              value={returnNote}
              onChange={(event) => setReturnNote(event.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={returnForCorrection.isPending}
              onClick={() =>
                returnForCorrection.mutate(returnNote, {
                  onSuccess: () => {
                    setReturnOpen(false)
                    setReturnNote("")
                  },
                })
              }
            >
              Return
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Calibrate the score</DialogTitle>
            <DialogDescription>
              The calculated score of{" "}
              <strong>{appraisal.calculatedScore ? Number(appraisal.calculatedScore).toFixed(2) : "—"}</strong> is
              kept on the record, along with every override and its reason.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="override-score">Final score (0–5)</Label>
              <Input
                id="override-score"
                type="number"
                step="0.01"
                min="0"
                max="5"
                value={overrideScore}
                onChange={(event) => setOverrideScoreValue(event.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="override-reason">Reason (required)</Label>
              <textarea
                id="override-reason"
                rows={3}
                value={overrideReason}
                onChange={(event) => setOverrideReason(event.target.value)}
                className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={override.isPending || !overrideReason.trim() || !overrideScore}
              onClick={() =>
                override.mutate(
                  { score: Number(overrideScore), reason: overrideReason },
                  {
                    onSuccess: () => {
                      setOverrideOpen(false)
                      setOverrideReason("")
                      setOverrideScoreValue("")
                    },
                  }
                )
              }
            >
              Save calibration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={ackOpen} onOpenChange={setAckOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge your appraisal</DialogTitle>
            <DialogDescription>
              This records that you have read it, with the date and your name. It is not an agreement or a
              rating of its own.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="ack-note">Anything to add? (optional)</Label>
            <textarea
              id="ack-note"
              rows={3}
              value={ackNote}
              onChange={(event) => setAckNote(event.target.value)}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              disabled={acknowledge.isPending}
              onClick={() => acknowledge.mutate(ackNote, { onSuccess: () => setAckOpen(false) })}
            >
              Acknowledge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
