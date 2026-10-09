"use client"

import { FileTextIcon } from "lucide-react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PdfPages } from "@/components/ui/pdf-pages"

const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"]

/** What a stored file can be shown as. Storage often records PDFs as
 * application/octet-stream, so the file name is the more reliable signal. */
export function fileKind(name: string | null | undefined, contentType?: string | null) {
  const lower = (name ?? "").toLowerCase()
  if (contentType === "application/pdf" || lower.endsWith(".pdf")) return "pdf" as const
  if (contentType?.startsWith("image/") || IMAGE_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "image" as const
  }
  if (lower.endsWith(".txt")) return "text" as const
  return "other" as const
}

/**
 * A stored file in a plain window: on white, at 100%, with only the X to
 * close — the same window the appraisal letter opens in. PDFs are drawn page
 * by page by PdfPages rather than the browser's viewer, so no tool row,
 * frame or dark backdrop appears around them.
 *
 * `url` must render inline (a preview route), not download as an attachment.
 */
export function FileWindow({
  open,
  onOpenChange,
  title,
  url,
  downloadUrl,
  kind,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  url: string
  downloadUrl: string
  kind: ReturnType<typeof fileKind>
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The dialog's own X, top right, is the only control. */}
      <DialogContent className="flex h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[860px] [&>[data-slot=dialog-close]]:top-3 [&>[data-slot=dialog-close]]:right-5">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {/* Mounted only while open, so the file is read when it is opened. */}
        {open && (
          <div className="min-h-0 flex-1 overflow-y-auto bg-white">
            {kind === "pdf" ? (
              <PdfPages src={url} />
            ) : kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element -- a private, cookie-authenticated file, not an optimisable asset
              <img src={url} alt={title} className="mx-auto block max-w-full p-8" />
            ) : kind === "text" ? (
              <iframe src={url} title={title} className="h-full w-full border-0 bg-white p-8" />
            ) : (
              <div className="grid h-full place-content-center justify-items-center gap-2 p-6 text-center">
                <FileTextIcon className="size-8 text-neutral-300" />
                <p className="text-sm text-neutral-500">This file type can&apos;t be shown here.</p>
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-role-hr hover:underline"
                >
                  Download to view
                </a>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
