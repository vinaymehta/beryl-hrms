"use client"

import { useState } from "react"
import { UsersRoundIcon, SendIcon, LockIcon, EyeIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { SearchSelect } from "@/components/ui/search-select"
import { Label } from "@/components/ui/label"
import { useAppraisalFeedback, useAppraisalFeedbackMutations } from "@/features/employees/hooks/use-employee-records"
import { useAssignableManagers } from "@/features/employees/hooks/use-employees"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import type { AppraisalDetail } from "@/types/appraisals"

const STATUS_CLASSES: Record<string, string> = {
  pending: "bg-warning/15 text-warning",
  submitted: "bg-success/15 text-success",
  declined: "bg-muted text-muted-foreground",
}

/**
 * Optional 360° / additional feedback (§21).
 *
 * "Optional" is load-bearing: nothing in the appraisal workflow waits on one of
 * these, so an outstanding request never blocks a transition. An authorized
 * holder requests; only the person asked may answer.
 */
export function FeedbackRequestsPanel({ appraisal }: { appraisal: AppraisalDetail }) {
  const { user } = useCurrentUser()
  const canRequest = usePermission(PERMISSIONS.appraisalFeedbackManage)
  const { data, isLoading } = useAppraisalFeedback(appraisal.id)
  const { request, respond } = useAppraisalFeedbackMutations(appraisal.id)

  const [search, setSearch] = useState("")
  const { data: candidates, isLoading: candidatesLoading } = useAssignableManagers(search, canRequest)
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [answering, setAnswering] = useState<string | null>(null)
  const [answer, setAnswer] = useState("")

  const requests = data ?? []
  const myEmployeeId = user?.employeeId ? String(user.employeeId) : null

  if (isLoading) return <Skeleton className="h-32 w-full rounded-lg" />
  if (!canRequest && requests.length === 0) return null

  const options = (candidates?.data ?? [])
    .filter((candidate) => String(candidate.id) !== String(appraisal.employeeId))
    .map((candidate) => ({
      value: String(candidate.id),
      label: `${candidate.firstName} ${candidate.lastName}`.trim(),
      description: [candidate.employeeCode, candidate.designation?.title].filter(Boolean).join(" · "),
    }))

  return (
    <div className="grid gap-3">
      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No additional feedback requested. This is optional and never blocks the appraisal.
        </p>
      ) : (
        <ul className="grid gap-2">
          {requests.map((feedback) => {
            const mine = myEmployeeId === String(feedback.requestedFromId)
            return (
              <li key={feedback.id} className="grid gap-1.5 rounded-lg border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{feedback.requestedFromName ?? "—"}</span>
                  <Badge className={STATUS_CLASSES[feedback.status]}>{feedback.status}</Badge>
                  {feedback.visibility === "management_only" ? (
                    <Badge className="gap-1 bg-warning/15 text-warning">
                      <LockIcon className="size-3" /> Management only
                    </Badge>
                  ) : (
                    <Badge className="gap-1 bg-success/15 text-success">
                      <EyeIcon className="size-3" /> Employee visible
                    </Badge>
                  )}
                </div>
                {feedback.prompt && <p className="text-xs text-muted-foreground">{feedback.prompt}</p>}
                {feedback.response && <p className="text-sm whitespace-pre-wrap">{feedback.response}</p>}

                {mine && feedback.status === "pending" && (
                  <div className="grid gap-2 border-t pt-2">
                    {answering === feedback.id ? (
                      <>
                        <textarea
                          rows={3}
                          value={answer}
                          onChange={(event) => setAnswer(event.target.value)}
                          placeholder="Your feedback…"
                          className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                        />
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => setAnswering(null)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="gap-1.5 bg-role-hr text-role-hr-foreground hover:bg-role-hr/90"
                            disabled={respond.isPending || !answer.trim()}
                            onClick={() =>
                              respond.mutate(
                                { id: feedback.id, response: answer },
                                { onSuccess: () => { setAnswering(null); setAnswer("") } }
                              )
                            }
                          >
                            <SendIcon className="size-3.5" /> Submit
                          </Button>
                        </div>
                      </>
                    ) : (
                      <Button variant="outline" size="sm" className="w-fit" onClick={() => setAnswering(feedback.id)}>
                        Give your feedback
                      </Button>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {canRequest && (
        <div className="grid gap-2 border-t pt-3">
          <Label htmlFor="feedback-from">Request feedback from</Label>
          <SearchSelect
            id="feedback-from"
            aria-label="Request feedback from"
            options={options}
            value={pickedId}
            onChange={setPickedId}
            onSearchChange={setSearch}
            isLoading={candidatesLoading}
            clearable
            placeholder="Select a colleague"
            searchPlaceholder="Search active employees…"
            emptyMessage="No active employees match that search."
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-1.5"
              disabled={!pickedId || request.isPending}
              onClick={() =>
                request.mutate(
                  { requestedFromId: pickedId },
                  { onSuccess: () => setPickedId(null) }
                )
              }
            >
              <UsersRoundIcon className="size-3.5" /> Request
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
