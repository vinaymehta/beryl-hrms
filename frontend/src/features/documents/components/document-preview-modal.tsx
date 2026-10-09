"use client"

import { FileWindow, fileKind } from "@/components/ui/file-window"
import { documentsApi } from "@/features/documents/api"
import type { EmployeeDocument } from "@/types/documents"

/**
 * The stored file itself, rendered rather than downloaded — in the same plain
 * window as the appraisal letter.
 *
 * Points at previewUrl, not downloadUrl: the download route sends
 * Content-Disposition: attachment, which makes the browser save the file no
 * matter what the page does with it.
 */
export function DocumentPreviewModal({
  document,
  open,
  onOpenChange,
}: {
  document: EmployeeDocument | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  if (!document) return null

  return (
    <FileWindow
      open={open}
      onOpenChange={onOpenChange}
      title={document.title || document.fileName || "Document"}
      url={documentsApi.previewUrl(document.id)}
      downloadUrl={documentsApi.downloadUrl(document.id)}
      kind={fileKind(document.fileName || document.title, document.contentType)}
    />
  )
}
