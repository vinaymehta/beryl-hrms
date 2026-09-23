"use client"

import { useState } from "react"
import { EyeIcon, LockIcon, SendIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useAddAppraisalComment } from "@/features/appraisals/hooks/use-appraisal-mutations"
import type { AppraisalDetail } from "@/types/appraisals"

/**
 * Comments, each carrying its audience.
 *
 * The list is already filtered server-side — a management_only row never
 * reaches an employee's response at all (AppraisalCommentPolicy::Scope), so
 * nothing here is merely hidden in the DOM.
 */
export function AppraisalComments({ appraisal }: { appraisal: AppraisalDetail }) {
  const [body, setBody] = useState("")
  const [managementOnly, setManagementOnly] = useState(appraisal.viewer.canSetManagementOnlyComment)
  const addComment = useAddAppraisalComment(appraisal.id)

  return (
    <div className="grid gap-3">
      {appraisal.comments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
          No comments yet.
        </p>
      ) : (
        <ul className="grid gap-2">
          {appraisal.comments.map((comment) => (
            <li key={comment.id} className="grid gap-1.5 rounded-lg border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{comment.authorName ?? "Unknown"}</span>
                {comment.visibility === "management_only" ? (
                  <Badge className="gap-1 bg-warning/15 text-warning">
                    <LockIcon className="size-3" /> Management only
                  </Badge>
                ) : (
                  <Badge className="gap-1 bg-success/15 text-success">
                    <EyeIcon className="size-3" /> Employee visible
                  </Badge>
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <form
        className="grid gap-2 border-t pt-3"
        onSubmit={(event) => {
          event.preventDefault()
          addComment.mutate(
            { body, visibility: managementOnly ? "management_only" : "employee_visible" },
            { onSuccess: () => setBody("") }
          )
        }}
      >
        <textarea
          rows={2}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Add a comment…"
          className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {appraisal.viewer.canSetManagementOnlyComment ? (
            <Label className="flex items-center gap-2 text-xs font-normal">
              <Checkbox checked={managementOnly} onCheckedChange={(next) => setManagementOnly(Boolean(next))} />
              Management only — not shown to the employee
            </Label>
          ) : (
            // Was "visible to management", which read as though the employee
            // was posting into somewhere they couldn't see. Their own comment
            // is saved employee_visible (AppraisalsController#add_comment
            // refuses to let them mark it otherwise), so it is visible to
            // them too — and now actually shows up in the list below.
            <span className="text-xs text-muted-foreground">
              Your comment is visible to you and to management.
            </span>
          )}
          <Button
            type="submit"
            size="sm"
            className="gap-1.5 bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
            disabled={addComment.isPending || !body.trim()}
          >
            <SendIcon className="size-3.5" />
            {addComment.isPending ? "Adding…" : "Add comment"}
          </Button>
        </div>
      </form>
    </div>
  )
}
