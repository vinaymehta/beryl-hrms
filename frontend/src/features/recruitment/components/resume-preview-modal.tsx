"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { recruitmentApi } from "../api"
import { FileTextIcon } from "lucide-react"

interface ResumePreviewModalProps {
  resumeId: string | null
  fileName?: string
  contentType?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Lightweight modal dedicated to just the original PDF — split out from the
 * resume detail modal (which now shows only the AI Summary) so "view the
 * source file" and "review the extracted profile" are two separate actions.
 */
export function ResumePreviewModal({ resumeId, fileName, contentType, open, onOpenChange }: ResumePreviewModalProps) {
  if (!resumeId) return null

  // Zoho attachment metadata frequently reports a generic
  // application/octet-stream content type even for genuine PDFs, so the
  // filename extension is the more reliable signal here.
  const canPreviewInline = contentType === "application/pdf" || !!fileName?.toLowerCase().endsWith(".pdf")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full sm:w-[70vw] sm:max-w-[70vw] h-[92vh] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="border-b p-4 pr-12 shrink-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <FileTextIcon className="size-4 text-role-recruitment shrink-0" />
            <span className="truncate">{fileName || "Resume Preview"}</span>
          </DialogTitle>
        </DialogHeader>

        {canPreviewInline ? (
          // The browser's built-in PDF viewer paints its own dark backdrop
          // behind the page whenever the iframe is wider than the page
          // itself — that backdrop is inside the viewer's internal chrome
          // and can't be recolored via CSS. Instead, constrain the iframe to
          // a page-appropriate width and center it, so the modal's own white
          // background shows on the sides instead of the viewer's backdrop.
          <div className="flex-1 overflow-hidden bg-white p-4">
            <iframe
              src={`${recruitmentApi.resumes.previewUrl(resumeId)}#toolbar=0&navpanes=0&view=FitH`}
              title="Original resume PDF"
              className="mx-auto h-full w-full max-w-3xl border-0 bg-white"
            />
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-muted-foreground">
            <FileTextIcon className="size-8 text-muted-foreground/40" />
            <p className="text-sm">Inline preview isn&apos;t available for this file type.</p>
            <a
              href={recruitmentApi.resumes.downloadUrl(resumeId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-role-recruitment hover:underline"
            >
              Download to view
            </a>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
