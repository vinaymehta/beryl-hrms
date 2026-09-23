"use client"

import { useRef, useState } from "react"
import {
  UploadIcon, DownloadIcon, CheckCircle2Icon, TriangleAlertIcon, FileSpreadsheetIcon, InfoIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LensBadge } from "@/features/appraisals/components/appraisal-badges"
import { appraisalTemplatesApi } from "@/features/appraisals/api"
import { ApiError } from "@/types/api"
import type { TemplateImportPreview } from "@/types/appraisals"

/**
 * The spreadsheet path into the template builder: Upload → Validate → Parse →
 * PREVIEW → admin confirms → Save.
 *
 * The upload writes nothing. What comes back is reviewed here and then loaded
 * into the builder, where it is edited and created through the ordinary
 * endpoint — so an imported template passes exactly the same rules as a typed
 * one, including the 100% weight total.
 */

/** One detected section, listed so the admin can see it survived the import. */
function DetectedSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: React.ReactNode
}) {
  if (count === 0) return null

  return (
    <div className="grid gap-1 rounded-lg border p-2.5">
      <p className="flex items-center justify-between gap-2 text-xs font-semibold">
        {title}
        <Badge variant="outline" className="tabular-nums">
          {count}
        </Badge>
      </p>
      {children}
    </div>
  )
}

/** Labels with whatever the workbook already had typed against them. */
function FieldList({ fields }: { fields: { label: string; value: string | null }[] }) {
  return (
    <ul className="grid gap-0.5">
      {fields.map((field) => (
        <li key={field.label} className="flex items-start justify-between gap-2 text-xs text-muted-foreground">
          <span>· {field.label}</span>
          {field.value && <span className="shrink-0 font-medium text-foreground">{field.value}</span>}
        </li>
      ))}
    </ul>
  )
}

export function TemplateImportPanel({
  onUse,
}: {
  onUse: (preview: TemplateImportPreview) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<TemplateImportPreview | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFile(file: File) {
    setIsUploading(true)
    try {
      setPreview(await appraisalTemplatesApi.importPreview(file))
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't read that file.")
      setPreview(null)
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <section className="grid gap-3 rounded-xl border border-dashed bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
            <FileSpreadsheetIcon className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-medium">Start from a spreadsheet</p>
            <p className="text-xs text-muted-foreground">
              One row per question, grouped by category. Nothing is saved until you create the template below.
            </p>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv"
          className="hidden"
          aria-label="Template spreadsheet"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <div className="flex flex-wrap gap-2">
          {/* A real anchor, because the workbook is a streamed download rather
              than a JSON call — so it opts out of Base UI's native-<button>
              requirement instead of silently losing button semantics. */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            nativeButton={false}
            render={<a href={appraisalTemplatesApi.importFormatUrl()} />}
          >
            <DownloadIcon className="size-3.5" /> Download format
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon className="size-3.5" />
            {isUploading ? "Reading…" : "Upload spreadsheet"}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1 bg-success/15 text-success">
              <CheckCircle2Icon className="size-3" />
              {preview.categories.length} categor{preview.categories.length === 1 ? "y" : "ies"}
            </Badge>
            <Badge variant="outline">{preview.questionCount} questions</Badge>
            <Badge
              className={cn(
                "gap-1 tabular-nums",
                preview.weightsValid ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
              )}
            >
              {preview.weightsValid ? (
                <CheckCircle2Icon className="size-3" />
              ) : (
                <TriangleAlertIcon className="size-3" />
              )}
              {preview.totalWeight.toFixed(2)}% weighted
            </Badge>
          </div>

          {preview.errors.length > 0 && (
            <ul className="grid gap-1 rounded-lg border border-warning/40 bg-warning/5 p-2.5">
              {preview.errors.map((error) => (
                <li key={error} className="flex items-start gap-1.5 text-xs text-warning">
                  <TriangleAlertIcon className="mt-px size-3 shrink-0" />
                  {error}
                </li>
              ))}
            </ul>
          )}

          {(preview.warnings?.length ?? 0) > 0 && (
            <ul className="grid gap-1 rounded-lg border border-info/40 bg-info/5 p-2.5">
              {preview.warnings!.map((warning) => (
                <li key={warning} className="flex items-start gap-1.5 text-xs text-info">
                  <InfoIcon className="mt-px size-3 shrink-0" />
                  {warning}
                </li>
              ))}
            </ul>
          )}

          {/* Anything the parser could not place. Empty is the normal case —
              it is here so a workbook the importer only half-understands says
              so out loud instead of quietly losing the rest. */}
          {(preview.unmappedRows?.length ?? 0) > 0 && (
            <div className="grid gap-1 rounded-lg border border-warning/40 bg-warning/5 p-2.5">
              <p className="text-xs font-semibold text-warning">
                {preview.unmappedRows!.length} row(s) were not recognised and will not be imported
              </p>
              <ul className="grid gap-0.5">
                {preview.unmappedRows!.map((row) => (
                  <li key={row.row} className="truncate text-xs text-muted-foreground">
                    Row {row.row}: {row.content}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="grid max-h-80 gap-1.5 overflow-y-auto">
            {preview.categories.map((category) => (
              <li key={`${category.name}-${category.position}`} className="grid gap-1 rounded-lg border p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">{category.name}</p>
                  <div className="flex items-center gap-1.5">
                    {category.lens ? (
                      <LensBadge lens={category.lens} />
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Perspective not set
                      </Badge>
                    )}
                    <Badge variant="outline" className="tabular-nums">
                      {category.weight}%
                    </Badge>
                  </div>
                </div>
                <ul className="grid gap-0.5">
                  {category.questions.map((question, index) => (
                    <li key={`${question.prompt}-${index}`} className="text-xs text-muted-foreground">
                      · {question.prompt}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>

          {/* Everything else the workbook carried. Shown before saving so the
              admin can confirm it was all read — the importer used to stop at
              the totals row and discard every one of these sections. */}
          {preview.layout === "sectioned" && (
            <div className="grid gap-1.5">
              <p className="text-xs font-semibold">Also detected in this workbook</p>

              <DetectedSection
                title="Employee information fields"
                count={preview.employeeFields?.fields.length ?? 0}
              >
                <FieldList fields={preview.employeeFields?.fields ?? []} />
                {(preview.employeeFields?.missing.length ?? 0) > 0 && (
                  <p className="text-xs text-warning">
                    Not found: {preview.employeeFields!.missing.join(", ")}
                  </p>
                )}
              </DetectedSection>

              <DetectedSection title="Performance perspectives" count={preview.perspectives?.length ?? 0}>
                <ul className="grid gap-0.5">
                  {preview.perspectives?.map((perspective) => (
                    <li
                      key={perspective.name}
                      className="flex items-start justify-between gap-2 text-xs text-muted-foreground"
                    >
                      <span>· {perspective.name}</span>
                      <span className="shrink-0 tabular-nums">{perspective.weight}%</span>
                    </li>
                  ))}
                </ul>
              </DetectedSection>

              <DetectedSection
                title="Development & career discussion"
                count={preview.developmentFields?.length ?? 0}
              >
                <FieldList fields={preview.developmentFields ?? []} />
              </DetectedSection>

              <DetectedSection title="Final review" count={preview.finalReviewFields?.length ?? 0}>
                <FieldList fields={preview.finalReviewFields ?? []} />
              </DetectedSection>

              <DetectedSection title="Rating guide" count={preview.ratingGuide?.length ?? 0}>
                <ul className="grid gap-0.5">
                  {preview.ratingGuide?.map((row) => (
                    <li key={row.rating ?? row.level} className="text-xs text-muted-foreground">
                      · <span className="font-medium text-foreground">{row.rating}</span> {row.level} —{" "}
                      {row.definition}
                    </li>
                  ))}
                </ul>
              </DetectedSection>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <p className="mr-auto text-xs text-muted-foreground">
              Loading this replaces what is in the builder below — you can still edit everything before saving.
            </p>
            <Button
              size="sm"
              disabled={preview.categories.length === 0}
              onClick={() => {
                onUse(preview)
                setPreview(null)
                toast.success("Loaded into the builder — review it, then create the template.")
              }}
            >
              Load into builder
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
