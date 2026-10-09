"use client"

import { FileWindow, fileKind } from "@/components/ui/file-window"
import { recruitmentApi } from "../api"

interface ResumePreviewModalProps {
  resumeId: string | null
  fileName?: string
  contentType?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Lightweight modal dedicated to just the original file — split out from the
 * resume detail modal (which now shows only the AI Summary) so "view the
 * source file" and "review the extracted profile" are two separate actions.
 * The same plain window as the appraisal letter.
 */
export function ResumePreviewModal({ resumeId, fileName, contentType, open, onOpenChange }: ResumePreviewModalProps) {
  if (!resumeId) return null

  return (
    <FileWindow
      open={open}
      onOpenChange={onOpenChange}
      title={fileName || "Resume"}
      url={recruitmentApi.resumes.previewUrl(resumeId)}
      downloadUrl={recruitmentApi.resumes.downloadUrl(resumeId)}
      kind={fileKind(fileName, contentType)}
    />
  )
}
