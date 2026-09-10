"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FileTextIcon, DownloadIcon, TrashIcon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { UploadDocumentDialog } from "@/features/documents/components/upload-document-dialog"
import { useDocuments, useDeleteDocument } from "@/features/documents/hooks/use-documents"
import { documentsApi } from "@/features/documents/api"
import { HIDDEN_FEATURES } from "@/constants/feature-flags"

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Hidden for this rollout (see feature-flags.ts) — direct navigation here
// bounces to the dashboard instead of rendering the page below, which stays
// fully intact for when this flag flips back.
export default function DocumentsPage() {
  const router = useRouter()

  useEffect(() => {
    if (HIDDEN_FEATURES.documents) router.replace("/")
  }, [router])

  const { data: documents, isLoading } = useDocuments()
  const deleteDocument = useDeleteDocument()
  const [pendingDelete, setPendingDelete] = useState<string | null>(null)

  if (HIDDEN_FEATURES.documents) return null

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
            <FileTextIcon className="size-4.5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Documents</h1>
        </div>
        <UploadDocumentDialog />
      </div>

      <Card>
        <CardContent className="grid gap-2 p-4">
          {isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : !documents?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No documents uploaded yet.</p>
          ) : (
            documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg bg-role-hr/10 text-role-hr">
                    <FileTextIcon className="size-4.5" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.employeeName} · {formatBytes(doc.byteSize)}
                    </p>
                  </div>
                  <Badge variant="outline">{doc.documentType}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    nativeButton={false}
                    render={<a href={documentsApi.downloadUrl(doc.id)} target="_blank" rel="noreferrer" />}
                  >
                    <DownloadIcon /> Download
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setPendingDelete(doc.id)}>
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>This can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={deleteDocument.isPending}
              onClick={() => {
                if (pendingDelete) deleteDocument.mutate(pendingDelete, { onSuccess: () => setPendingDelete(null) })
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
