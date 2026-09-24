"use client"

import { useRef, useState } from "react"
import { UploadIcon, DownloadIcon, CheckCircle2Icon, TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { appraisalsApi } from "@/features/appraisals/api"
import { ApiError } from "@/types/api"
import type { ImportPreview, ImportPreviewResponse, ImportPreviewRow } from "@/types/appraisals"

/**
 * The scope's Excel path: Upload → Validate → Parse → Preview → Confirm.
 *
 * Nothing is written by the upload. The parsed values are shown here, and
 * "Use these answers" hands them to the ordinary self-appraisal form — so the
 * employee still reviews and submits through the normal path, and the database
 * stays the system of record rather than the spreadsheet.
 *
 * Two kinds of file arrive here. One is the answer sheet this panel's own
 * Download button produces. The other is a filled-in copy of the company
 * appraisal workbook — the document people were actually handed, which also
 * carries the development, final-review and perspective prose, not only
 * ratings. The preview reports both what it matched and what it couldn't, so
 * a workbook that has drifted from the template says so here rather than
 * losing the difference silently.
 */
export function SelfAppraisalImport({
  appraisalId,
  onConfirm,
  /**
   * Drops the "Prefer a spreadsheet?" framing and renders just the two
   * buttons, for a caller that already has a section header to hang them on.
   * The upload flow is unchanged — only the surrounding blurb goes.
   */
  compact,
}: {
  appraisalId: string
  onConfirm: (rows: ImportPreviewRow[], responses: ImportPreviewResponse[]) => void
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  async function handleFile(file: File) {
    setIsUploading(true)
    try {
      setPreview(await appraisalsApi.importPreview(appraisalId, file))
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't read that file.")
      setPreview(null)
    } finally {
      setIsUploading(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  return (
    <div className={cn("grid gap-3", !compact && "rounded-xl border border-dashed p-4")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!compact && (
          <div>
            <p className="text-sm font-medium">Prefer a spreadsheet?</p>
            <p className="text-xs text-muted-foreground">
              Download the workbook, fill in Rating and Comments, upload it back. Nothing is saved until you submit.
            </p>
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xlsm,.csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) handleFile(file)
          }}
        />
        <div className="flex gap-2">
          {/* A plain link, not the JSON client: the workbook is streamed. It
              carries hidden metadata binding it to THIS appraisal, which the
              importer checks. */}
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            // A real anchor, because the workbook is a streamed download rather
            // than a JSON call — so it opts out of Base UI's native-<button>
            // requirement instead of silently losing button semantics.
            nativeButton={false}
            render={<a href={appraisalsApi.exportUrl(appraisalId)} />}
          >
            <DownloadIcon className="size-3.5" /> Download workbook
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" disabled={isUploading} onClick={() => inputRef.current?.click()}>
            <UploadIcon className="size-3.5" />
            {isUploading ? "Reading…" : "Upload filled file"}
          </Button>
        </div>
      </div>

      {preview && (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="gap-1 bg-success/15 text-success">
              <CheckCircle2Icon className="size-3" />
              {preview.validCount} ready
            </Badge>
            {preview.invalidCount > 0 && (
              <Badge className="gap-1 bg-warning/15 text-warning">
                <TriangleAlertIcon className="size-3" />
                {preview.invalidCount} need attention
              </Badge>
            )}
            {preview.responses.length > 0 && (
              <Badge className="gap-1 bg-info/15 text-info">
                <CheckCircle2Icon className="size-3" />
                {preview.responses.length} written answer
                {preview.responses.length === 1 ? "" : "s"}
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {preview.totalQuestions} question{preview.totalQuestions === 1 ? "" : "s"} in this template
            </span>
          </div>

          {/* What had nowhere to go. Named rather than dropped: if the
              workbook has drifted from the template — a section renamed, an
              area removed — the person needs to know which of their writing
              isn't coming across, not discover it missing after submitting. */}
          {preview.unmatched.length > 0 && (
            <div className="grid gap-1 rounded-lg border border-warning/40 bg-warning/5 p-2.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-warning">
                <TriangleAlertIcon className="size-3.5" />
                {preview.unmatched.length} item{preview.unmatched.length === 1 ? "" : "s"} in your file
                {preview.unmatched.length === 1 ? " doesn't" : " don't"} match this form
              </p>
              <ul className="grid gap-0.5">
                {preview.unmatched.map((entry) => (
                  <li key={`${entry.section}-${entry.label}`} className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">{entry.label}</span> — {entry.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {preview.missingFields.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Not in your file, so still to fill in here:{" "}
              {preview.missingFields.map((field) => field.label).join(", ")}.
            </p>
          )}

          <ul className="grid max-h-64 gap-1.5 overflow-y-auto">
            {preview.rows.map((row, index) => (
              <li
                key={`${row.questionId}-${index}`}
                className="grid gap-0.5 rounded-lg border bg-card p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{row.prompt}</p>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {row.rating ?? "—"}
                  </Badge>
                </div>
                {row.comment && <p className="text-xs text-muted-foreground">{row.comment}</p>}
                {row.errors.map((error) => (
                  <p key={error} className="flex items-center gap-1 text-xs text-warning">
                    <TriangleAlertIcon className="size-3" />
                    {error}
                  </p>
                ))}
              </li>
            ))}
          </ul>

          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={preview.validCount === 0 && preview.responses.length === 0}
              onClick={() => {
                onConfirm(
                  preview.rows.filter((row) => row.errors.length === 0),
                  preview.responses
                )
                setPreview(null)
                toast.success("Answers filled in — review them, then submit.")
              }}
            >
              Use these answers
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
