"use client"

import { useRef, useState } from "react"
import {
  UploadIcon, DownloadIcon, CheckCircle2Icon, TriangleAlertIcon, FileSpreadsheetIcon, InfoIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { appraisalTemplatesApi } from "@/features/appraisals/api"
import { ApiError } from "@/types/api"
import type { TemplateImportPreview } from "@/types/appraisals"

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
      const result = await appraisalTemplatesApi.importPreview(file)
      // Loaded straight into the builder — no second "load" step. What was
      // read stays listed above it, and anything the file got wrong is still
      // reported; a file with no categories loads nothing.
      if (result.categories.length > 0) {
        onUse(result)
        toast.success("Loaded into the builder — review it, then create the template.")
      }
      setPreview(result)
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

          <p className="text-xs text-muted-foreground">
            {preview.categories.length > 0
              ? "Loaded into the builder below — you can still edit everything before creating the template."
              : "Nothing was loaded: no categories were found in this file."}
          </p>
        </div>
      )}
    </section>
  )
}
