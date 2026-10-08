"use client"

import { useState } from "react"
import {
  SkipForwardIcon,
  SendIcon,
  SignatureIcon,
  TriangleAlertIcon,
  UndoIcon,
  SlidersHorizontalIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import {
  useAdvanceAppraisal,
  useReturnForCorrection,
  useSkipFinalReview,
  useOverrideScore,
  useReleaseAppraisal,
} from "@/features/appraisals/hooks/use-appraisal-mutations"
import {
  LetterStatusLine,
  SignLetterPanel,
} from "@/features/appraisals/components/appraisal-letter"
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
  const [releaseOpen, setReleaseOpen] = useState(false)
  const [signOpen, setSignOpen] = useState(false)

  const advance = useAdvanceAppraisal(appraisal.id)
  const returnForCorrection = useReturnForCorrection(appraisal.id)
  const skipFinal = useSkipFinalReview(appraisal.id)
  const [skipOpen, setSkipOpen] = useState(false)
  const override = useOverrideScore(appraisal.id)
  const release = useReleaseAppraisal(appraisal.id)

  const canClose = viewer.isAdministrator && status === "employee_acknowledged"
  // Returning and calibrating are discussion-phase decisions — offered only
  // there, not while the self-appraisal or the reviews are still in progress.
  const inDiscussion = status === "appraisal_discussion" || status === "compensation_approval"
  const canReturn = viewer.canReturnForCorrection && inDiscussion
  const canCalibrate = viewer.canOverrideScore && inDiscussion
  const canReleaseNow = viewer.canRelease && inDiscussion
  // The employee signs from their Letter tab. Only an administrator signing
  // their own letter — who gets no Letter tab — signs from here.
  const canSignHere = viewer.canSign && viewer.isAdministrator
  // Exactly the buttons rendered below — otherwise the bar shows up empty for
  // someone who MAY release but has nothing releasable yet.
  // The Final review is optional for Admin/HR (a manager who is also Admin/HR
  // reviews at their own level like any manager, and is not offered this).
  const canSkipFinal = viewer.canSkipFinalReview
  const anyAction =
    canReturn || canCalibrate || canReleaseNow || canSignHere || canClose || canSkipFinal
  // Admin/HR (and reviewers, once signed) see where the letter stands beside
  // the actions — the employee has their own Letter tab for that.
  const showLetterStatus = !viewer.isSubject && Boolean(appraisal.letter?.available)
  // Release refuses without a saved effective date; say so before the click.
  const missingEffectiveDate = Boolean(appraisal.discussion && !appraisal.discussion.effectiveDate)

  return (
    <>
      {(anyAction || showLetterStatus) && (
        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border bg-background p-3 shadow-[0_-1px_8px_rgba(0,0,0,0.06)]">
          {showLetterStatus && <LetterStatusLine appraisal={appraisal} />}

          {canSkipFinal && (
            <Button
              variant="outline"
              className="gap-1.5"
              disabled={skipFinal.isPending}
              onClick={() => setSkipOpen(true)}
            >
              <SkipForwardIcon className="size-4" /> Skip final review
            </Button>
          )}

          {canReturn && (
            <Button variant="outline" className="gap-1.5" onClick={() => setReturnOpen(true)}>
              <UndoIcon className="size-4" /> Return for correction
            </Button>
          )}

          {canCalibrate && (
            <Button variant="outline" className="gap-1.5" onClick={() => setOverrideOpen(true)}>
              <SlidersHorizontalIcon className="size-4" /> Calibrate score
            </Button>
          )}

          {/* compensation_approval stays accepted although nothing enters it any
              more: an appraisal already parked there must still be releasable.
              Release asks first: it emails the employee their letter. */}
          {canReleaseNow && (
            <Button
              className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
              disabled={release.isPending}
              onClick={() => setReleaseOpen(true)}
            >
              <SendIcon className="size-4" /> {release.isPending ? "Sending…" : "Send"}
            </Button>
          )}

          {canSignHere && (
            <Button
              className="gap-1.5 bg-success text-success-foreground shadow-2xs hover:bg-success/90"
              onClick={() => setSignOpen(true)}
            >
              <SignatureIcon className="size-4" /> Review &amp; sign letter
            </Button>
          )}

          {canClose && (
            <Button
              variant="outline"
              disabled={advance.isPending}
              onClick={() => advance.mutate({ to: "closed" })}
            >
              Close appraisal
            </Button>
          )}

          <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Skip the final review?</DialogTitle>
                <DialogDescription>
                  The appraisal moves on to the Discussion step without a final review. The last
                  manager&apos;s review — and its score — stands as the final one.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Cancel</Button>} />
                <Button
                  disabled={skipFinal.isPending}
                  onClick={() =>
                    skipFinal.mutate(undefined, { onSuccess: () => setSkipOpen(false) })
                  }
                >
                  {skipFinal.isPending ? "Skipping…" : "Skip final review"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Return for correction</DialogTitle>
                <DialogDescription>
                  This reopens the self-appraisal. Nothing already submitted is deleted — the next
                  submission becomes a new version alongside the existing ones.
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
                  <strong>
                    {appraisal.calculatedScore ? Number(appraisal.calculatedScore).toFixed(2) : "—"}
                  </strong>{" "}
                  is kept on the record, along with every override and its reason.
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

          <Dialog open={releaseOpen} onOpenChange={setReleaseOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Release &amp; send the letter?</DialogTitle>
                <DialogDescription>
                  {appraisal.employeeName ?? "The employee"} will be emailed their appraisal letter
                  to review and sign, and will see it in the app. The decision can&apos;t be changed
                  after release.
                </DialogDescription>
              </DialogHeader>
              {missingEffectiveDate && (
                <p className="flex items-start gap-1.5 rounded-lg bg-warning/10 px-2.5 py-2 text-xs text-warning">
                  <TriangleAlertIcon className="mt-px size-3.5 shrink-0" />
                  Save the decision with an effective date before releasing.
                </p>
              )}
              <DialogFooter>
                <DialogClose render={<Button variant="outline">Cancel</Button>} />
                <Button
                  className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
                  disabled={release.isPending || missingEffectiveDate}
                  onClick={() =>
                    release.mutate(undefined, { onSuccess: () => setReleaseOpen(false) })
                  }
                >
                  <SendIcon className="size-4" />{" "}
                  {release.isPending ? "Releasing…" : "Release & send"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Outside the bar: signing removes the Sign action, and with it
          possibly the whole bar — the panel must stay to show it is signed. */}
      {viewer.isSubject && (
        <SignLetterPanel appraisal={appraisal} open={signOpen} onOpenChange={setSignOpen} />
      )}
    </>
  )
}
