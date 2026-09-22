"use client"

import { useRouter } from "next/navigation"
import { PlusIcon, CopyIcon, CheckCircle2Icon, LayersIcon, LockIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { LensBadge } from "@/features/appraisals/components/appraisal-badges"
import { useAppraisalTemplates } from "@/features/appraisals/hooks/use-appraisals"
import { useActivateTemplate } from "@/features/appraisals/hooks/use-appraisal-mutations"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import type { AppraisalTemplate } from "@/types/appraisals"

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-success/15 text-success",
  archived: "bg-muted text-muted-foreground",
}

export function TemplatesView() {
  const router = useRouter()
  const canManage = usePermission(PERMISSIONS.appraisalTemplatesManage)

  const { data: templates, isLoading } = useAppraisalTemplates()
  const activate = useActivateTemplate()

  // A full page rather than a drawer — a template is a long nested document,
  // and `?source=` makes "new version of X" a linkable, reloadable URL.
  function openNew() {
    router.push("/appraisals/templates/new")
  }

  function openNewVersion(template: AppraisalTemplate) {
    router.push(`/appraisals/templates/new?source=${template.id}`)
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

                {canManage && (
                  <div className="flex flex-wrap gap-2 border-t pt-3">
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
                    {/* The only safe way to change a template history depends on
                        — the original is left exactly as it is (§11). */}
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => openNewVersion(template)}>
                      <CopyIcon className="size-3.5" /> New version
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
