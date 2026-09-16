"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileTextIcon } from "lucide-react"

import { documentsApi } from "@/features/documents/api"
import type { EmployeeDocument } from "@/types/documents"

/**
 * The stored file itself, rendered rather than downloaded.
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

  // Storage records application/octet-stream for plenty of ordinary PDFs, so
  // the filename is the more reliable signal — the same reason the backend
  // resolves the inline content type from the extension.
  const name = (document.fileName || document.title || "").toLowerCase()
  const canPreviewInline =
    document.contentType === "application/pdf" ||
    [".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".txt"].some((ext) => name.endsWith(ext))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] w-full flex-col gap-0 overflow-hidden p-0 sm:w-[70vw] sm:max-w-[70vw]">
        <DialogHeader className="shrink-0 border-b p-4 pr-12">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileTextIcon className="size-4 shrink-0 text-role-hr" />
            <span className="truncate">{document.title || document.fileName}</span>
          </DialogTitle>
        </DialogHeader>

        {canPreviewInline ? (
          // The browser's PDF viewer paints its own dark backdrop whenever the
          // frame is wider than the page, and that backdrop is inside the
          // viewer's chrome where CSS can't reach it. Constraining the frame to
          // a page-ish width keeps the modal's own background at the sides.
          <div className="flex-1 overflow-hidden bg-white p-4">
            <iframe
              src={`${documentsApi.previewUrl(document.id)}#toolbar=0&navpanes=0&view=FitH`}
              title={document.title || "Document preview"}
              className="mx-auto h-full w-full max-w-3xl border-0 bg-white"
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <FileTextIcon className="size-8 text-muted-foreground/40" />
            <p className="text-sm">Inline preview isn&apos;t available for this file type.</p>
            <a
              href={documentsApi.downloadUrl(document.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-role-hr hover:underline"
            >
              Download to view
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
