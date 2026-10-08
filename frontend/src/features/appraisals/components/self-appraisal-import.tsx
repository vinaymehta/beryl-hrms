"use client"

import { useImperativeHandle, useRef, useState, type Ref } from "react"
import { UploadIcon, DownloadIcon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { appraisalsApi } from "@/features/appraisals/api"
import { ApiError } from "@/types/api"
import type { ImportPreviewResponse, ImportPreviewRow } from "@/types/appraisals"

/**
 * The scope's Excel path: Upload → Validate → Parse → filled into the form.
 *
 * Nothing is written by the upload. The parsed values go straight into the
 * ordinary self-appraisal form — so the
 * employee still reviews and submits through the normal path, and the database
 * stays the system of record rather than the spreadsheet.
 *
 * Two kinds of file arrive here. One is the answer sheet this panel's own
 * Download button produces. The other is a filled-in copy of the company
 * appraisal workbook — the document people were actually handed, which also
 * carries the development, final-review and perspective prose, not only
 * ratings. Rows that couldn't be read are reported in a toast, so a workbook
 * that has drifted from the template says so rather than losing the
 * difference silently.
 */
/** Lets a caller (the form's Tools menu) open the file picker itself. */
export interface SelfAppraisalImportHandle {
  openFilePicker: () => void
}

export function SelfAppraisalImport({
  appraisalId,
  onConfirm,
  /**
   * Drops the "Prefer a spreadsheet?" framing and renders just the two
   * buttons, for a caller that already has a section header to hang them on.
   * The upload flow is unchanged — only the surrounding blurb goes.
   */
  compact,
  /** Render no buttons of its own — the caller triggers download/upload. */
  hideButtons,
  controlRef,
}: {
  appraisalId: string
  onConfirm: (rows: ImportPreviewRow[], responses: ImportPreviewResponse[]) => void
  compact?: boolean
  hideButtons?: boolean
  controlRef?: Ref<SelfAppraisalImportHandle>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(controlRef, () => ({ openFilePicker: () => inputRef.current?.click() }), [])
  const [isUploading, setIsUploading] = useState(false)

  async function handleFile(file: File) {
    setIsUploading(true)
    try {
      const result = await appraisalsApi.importPreview(appraisalId, file)
      // Filled straight into the form — no second "use these answers" step,
      // and no list of what was read: the form itself shows it.
      const valid = result.rows.filter((row) => row.errors.length === 0)
      if (valid.length > 0 || result.responses.length > 0) {
        onConfirm(valid, result.responses)
        toast.success(
          `Filled in ${valid.length} rating${valid.length === 1 ? "" : "s"}${
            result.responses.length ? ` and ${result.responses.length} written answer${result.responses.length === 1 ? "" : "s"}` : ""
          } — review them, then submit.`
        )
      } else {
        toast.error("Nothing in that file could be used.")
      }
      // Only what could NOT be read is reported, so it can be fixed by hand.
      const skipped = result.rows.length - valid.length
      if (skipped > 0 && valid.length > 0) {
        toast.warning(`${skipped} row${skipped === 1 ? "" : "s"} couldn't be read — fill ${skipped === 1 ? "it" : "them"} in on the form.`)
      }
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Couldn't read that file.")
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
              Download the workbook, fill in Rating (1–5, halves like 3.5 allowed) and Comments, upload it back.
              Nothing is saved until you submit.
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
        {!hideButtons && <div className="flex gap-2">
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
        </div>}
      </div>

    </div>
  )
}
