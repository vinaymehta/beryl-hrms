"use client"

import { useState } from "react"
import { DownloadIcon, EyeIcon, FileTextIcon, TrashIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { documentsApi } from "@/features/documents/api"
import { useDocuments, useDeleteDocument } from "@/features/documents/hooks/use-documents"
import { UploadDocumentDialog } from "@/features/documents/components/upload-document-dialog"
import { DocumentPreviewModal } from "@/features/documents/components/document-preview-modal"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import { categoryLabel, type EmployeeDocument } from "@/types/documents"

function formatBytes(bytes: number) {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// The extension is a better label than the stored MIME type, which is
// application/octet-stream for most uploads regardless of what they are.
function fileKind(document: EmployeeDocument) {
  const name = document.fileName || document.title || ""
  const ext = name.includes(".") ? name.split(".").pop() : null
  return ext ? ext.toUpperCase() : "FILE"
}

/**
 * An employee's documents, shown inside their detail page.
 *
 * Who sees what is decided by the backend (DocumentPolicy::Scope returns only
 * what this viewer may see), so this component can render the same thing for
 * everyone. The permission checks here only decide which CONTROLS to offer —
 * they are a UI hint, never the access control itself.
 */
export function EmployeeDocumentsSection({ employeeId }: { employeeId: string }) {
  const { user } = useCurrentUser()
  const canViewDocuments = usePermission(PERMISSIONS.documentsView)
  const canManageAll = usePermission(PERMISSIONS.documentsCreate)
  const canManageOwn = usePermission(PERMISSIONS.documentsManageOwn)
  const canDeleteAnything = usePermission(PERMISSIONS.documentsDelete)

  const [previewing, setPreviewing] = useState<EmployeeDocument | null>(null)
  const [pendingDelete, setPendingDelete] = useState<EmployeeDocument | null>(null)
  const deleteDocument = useDeleteDocument()

  // employeeId arrives as a string from the route; the API serializes ids as
  // numbers. Comparing them without coercing would make every employee look
  // like someone else and hide their own documents from them.
  const isOwnRecord = user?.employeeId != null && String(user.employeeId) === String(employeeId)

  // Someone with company-wide access sees any record; everyone else only
  // their own. Rendering an always-empty section on a colleague's page would
  // imply they simply have no documents, which isn't what happened.
  const canSeeThisSection = canViewDocuments && (canManageAll || isOwnRecord)
  const canUploadHere = canManageAll || (canManageOwn && isOwnRecord)

  // Mirrors DocumentPolicy#destroy?: whoever uploaded a file may take it back
  // down, so a wrong upload is the uploader's own to fix rather than a job for
  // HR. Deliberately keyed on the uploader and not on whose record it sits
  // against — an employee must not be able to delete HR's copy of their signed
  // contract. The backend enforces this independently; this only decides
  // whether the button is offered.
  function canDeleteDocument(document: EmployeeDocument) {
    if (canDeleteAnything) return true
    if (!canManageOwn || !user?.id) return false
    return document.uploadedById != null && String(document.uploadedById) === String(user.id)
  }

  const { data: documents, isLoading } = useDocuments(employeeId, { enabled: canSeeThisSection })

  if (!canSeeThisSection) return null

  return (
    <Card className="sm:col-span-2">
      {/* `flex`, not just `flex-row`: CardHeader is display:grid by default, so
          flex-row on its own sets a direction nothing reads and the title and
          button stay stacked as two grid rows. */}
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <CardTitle className="text-base">Documents</CardTitle>
        {canUploadHere && <UploadDocumentDialog employeeId={employeeId} />}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="grid gap-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : !documents?.length ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <FileTextIcon className="mx-auto size-8 text-muted-foreground/40" />
            <p className="mt-2 text-sm font-medium text-foreground">No documents yet</p>
            <p className="text-xs text-muted-foreground">
              {canUploadHere
                ? "Upload one to keep it on file against this employee."
                : "Nothing has been filed against this employee."}
            </p>
          </div>
        ) : (
          <ul className="grid gap-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
                    <FileTextIcon className="size-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {document.title || document.fileName}
                    </p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <Badge variant="outline" className="font-normal">
                        {categoryLabel(document)}
                      </Badge>
                      <span>{new Date(document.createdAt).toLocaleDateString()}</span>
                      <span aria-hidden>·</span>
                      <span>{fileKind(document)}</span>
                      <span aria-hidden>·</span>
                      <span>{formatBytes(document.byteSize)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() => setPreviewing(document)}
                    title="Preview"
                    className="text-muted-foreground hover:text-role-hr"
                  >
                    <EyeIcon className="size-4" />
                    <span className="sr-only">Preview {document.title}</span>
                  </Button>

                  <a
                    href={documentsApi.downloadUrl(document.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Download"
                    className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-role-hr"
                  >
                    <DownloadIcon className="size-4" />
                    <span className="sr-only">Download {document.title}</span>
                  </a>

                  {canDeleteDocument(document) && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setPendingDelete(document)}
                      title="Delete"
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <TrashIcon className="size-4" />
                      <span className="sr-only">Delete {document.title}</span>
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <DocumentPreviewModal
        document={previewing}
        open={!!previewing}
        onOpenChange={(open) => !open && setPreviewing(null)}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>
              {pendingDelete?.title} will be removed permanently. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} />
            <Button
              variant="destructive"
              disabled={deleteDocument.isPending}
              onClick={() => {
                if (!pendingDelete) return
                deleteDocument.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })
              }}
            >
              {deleteDocument.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
