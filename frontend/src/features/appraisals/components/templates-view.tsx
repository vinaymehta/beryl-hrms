"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, CopyIcon, CheckCircle2Icon, LayersIcon, LockIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LensBadge } from "@/features/appraisals/components/appraisal-badges"
import { useAppraisalTemplates } from "@/features/appraisals/hooks/use-appraisals"
import { useActivateTemplate, useDeleteTemplate } from "@/features/appraisals/hooks/use-appraisal-mutations"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import type { AppraisalTemplate } from "@/types/appraisals"

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
}

/**
 * Editing in place is for a draft, and only a draft.
 *
 * An active template may have cycles running against it, and the appraisals in
 * those cycles were written to its questions and weights; changing it
 * underneath them would silently rewrite what people were asked. The supported
 * move there is New version, which leaves the original exactly as it is.
 */
function editable(template: AppraisalTemplate) {
  return template.status === "draft" && !template.inUse
}

function editReason(template: AppraisalTemplate) {
  if (template.inUse) return "A cycle has used this template — create a new version instead"
  if (template.status === "active") return "An active template is frozen — create a new version"
  if (template.status === "archived") return "This template has been deleted"
  return null
}

export function TemplatesView() {
  const router = useRouter()
  const canManage = usePermission(PERMISSIONS.appraisalTemplatesManage)

  const { data: templates, isLoading } = useAppraisalTemplates()
  const activate = useActivateTemplate()
  const deleteTemplate = useDeleteTemplate()
  const [viewing, setViewing] = useState<AppraisalTemplate | null>(null)
  const [deleting, setDeleting] = useState<AppraisalTemplate | null>(null)

  // A full page rather than a drawer — a template is a long nested document,
  // and `?source=` makes "new version of X" a linkable, reloadable URL.
  function openNew() {
    router.push("/appraisals/templates/new")
  }

  function openNewVersion(template: AppraisalTemplate) {
    router.push(`/appraisals/templates/new?source=${template.id}`)
  }

  // The same builder page, told which template it is editing. A template is a
  // long nested document, so it gets a page rather than a dialog.
  function openEdit(template: AppraisalTemplate) {
    router.push(`/appraisals/templates/new?edit=${template.id}`)
  }

  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {templates?.length ?? 0} template{templates?.length === 1 ? "" : "s"}
        </p>
        {canManage && (
          <Button onClick={openNew} className="gap-1.5">
            <PlusIcon className="size-4" /> New template
          </Button>
        )}
      </div>

      {(templates?.length ?? 0) === 0 ? (
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed p-12 text-center">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-role-hr/10 text-role-hr">
            <LayersIcon className="size-5" />
          </span>
          <p className="text-sm font-semibold">No templates yet</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            A template is the weighted question set a cycle runs on. Weights must total 100%.
          </p>
          {canManage && (
            <Button size="sm" className="mt-1 gap-1.5" onClick={openNew}>
              <PlusIcon className="size-4" /> New template
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {templates?.map((template) => (
            <Card key={template.id}>
              <CardContent className="grid gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Version {template.version} · {template.categories.length} categories
                    </p>
                  </div>
                  <Badge className={STATUS_CLASSES[template.status]}>{template.status}</Badge>
                </div>

                <div className="flex flex-wrap gap-1">
                  {[...new Set(template.categories.map((c) => c.lens))].map((lens) => (
                    <LensBadge key={lens} lens={lens} />
                  ))}
                </div>

                <div className="flex items-center gap-1.5 text-xs">
                  <span
                    className={
                      Math.abs(template.totalWeight - 100) < 0.01 ? "text-success" : "text-warning"
                    }
                  >
                    {template.totalWeight.toFixed(2)}% weighted
                  </span>
                  {template.inUse && (
                    <Badge variant="outline" className="gap-1 text-[11px]">
                      <LockIcon className="size-3" /> In use — frozen
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 border-t pt-3">
                  {/* Viewing is for everybody who can see the list — reading a
                      template is not a management act. */}
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setViewing(template)}
                  >
                    <EyeIcon className="size-3.5" /> View
                  </Button>

                  {canManage && (
                    <>
                      {/* Editing in place is only ever safe for a DRAFT. Once a
                          template is active, cycles may be running against it
                          and their appraisals were written to its questions —
                          changing it underneath them would rewrite history, so
                          the answer there is a new version, not an edit. */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled={!editable(template)}
                        title={editReason(template) ?? `Edit ${template.name}`}
                        onClick={() => openEdit(template)}
                      >
                        <PencilIcon className="size-3.5" /> Edit
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 text-muted-foreground hover:text-destructive"
                        disabled={template.inUse || deleteTemplate.isPending}
                        title={
                          template.inUse
                            ? "A cycle has used this template — create a new version instead"
                            : `Delete ${template.name}`
                        }
                        onClick={() => setDeleting(template)}
                      >
                        <Trash2Icon className="size-3.5" /> Delete
                      </Button>

                      {template.status === "draft" && (
                        <Button
                          size="sm"
                          className="gap-1.5 bg-role-hr text-role-hr-foreground hover:bg-role-hr/90"
                          disabled={activate.isPending || Math.abs(template.totalWeight - 100) >= 0.01}
                          onClick={() => activate.mutate(template.id)}
                        >
                          <CheckCircle2Icon className="size-3.5" /> Activate
                        </Button>
                      )}

                      {/* The only safe way to change a template history depends
                          on — the original is left exactly as it is (§11). */}
                      <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNewVersion(template)}>
                        <CopyIcon className="size-3.5" /> New version
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {viewing && (
        <TemplateDetailDialog template={viewing} onOpenChange={(open) => !open && setViewing(null)} />
      )}

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.name}?</DialogTitle>
            <DialogDescription>
              It stops being offered when a cycle is created. Nothing that already ran against it
              is affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={deleteTemplate.isPending}
              onClick={() =>
                deleting && deleteTemplate.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
              }
            >
              {deleteTemplate.isPending ? "Deleting…" : "Delete template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Read-only: the whole template, without any risk of editing it. */
function TemplateDetailDialog({
  template,
  onOpenChange,
}: {
  template: AppraisalTemplate
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader className="shrink-0">
          <DialogTitle>{template.name}</DialogTitle>
          <DialogDescription>
            Version {template.version} · {template.status} · {template.totalWeight.toFixed(2)}% weighted
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <ul className="grid gap-3">
            {template.categories.map((category) => (
              <li key={category.id} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{category.name}</p>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {Number(category.weight)}%
                  </Badge>
                </div>
                {category.description && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{category.description}</p>
                )}
                {category.questions.length > 0 && (
                  <ul className="mt-2 grid gap-1 border-t pt-2">
                    {category.questions.map((question) => (
                      <li key={question.id} className="text-xs text-muted-foreground">
                        {question.prompt}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </div>
        <DialogFooter className="shrink-0">
          <DialogClose render={<Button variant="outline">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
