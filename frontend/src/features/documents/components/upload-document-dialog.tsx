"use client"

import { useState } from "react"
import { UploadIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { useUploadDocument } from "@/features/documents/hooks/use-documents"
import { DOCUMENT_CATEGORIES, OTHER_CATEGORY } from "@/types/documents"

/**
 * Upload a document against one employee.
 *
 * Category is deliberately not pre-selected: a default would be silently
 * accepted on every hurried upload, and the whole point of making it required
 * is that someone actually chooses.
 *
 * employeeId is optional because a document need not belong to anyone — the
 * model has always allowed a company-wide file (a policy PDF, say) with no
 * employee. Omitting it is only permitted for holders of documents.create;
 * the backend refuses it for documents.manage_own, which can target nothing
 * but the uploader's own record.
 */
export function UploadDocumentDialog({ employeeId }: { employeeId?: string }) {
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [category, setCategory] = useState("")
  const [customCategory, setCustomCategory] = useState("")
  const upload = useUploadDocument()

  const isOther = category === OTHER_CATEGORY
  // Mirrors the model's own rules (Document validates both), so an obviously
  // incomplete form is caught here instead of via a round trip.
  const canSubmit =
    Boolean(file) && Boolean(category) && (!isOther || customCategory.trim().length > 0) && !upload.isPending

  function reset() {
    setFile(null)
    setCategory("")
    setCustomCategory("")
  }

  function handleSubmit() {
    if (!file || !canSubmit) return
    upload.mutate(
      {
        file,
        documentType: category,
        // Sent only for "Other" — the backend rejects it on any other
        // category, where it would be a second, contradictory name.
        customCategory: isOther ? customCategory.trim() : undefined,
        employeeId,
      },
      {
        onSuccess: () => {
          setOpen(false)
          reset()
        },
      }
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      {/* Compact, and labelled just "Upload": it sits directly beside the
          "Documents" heading, which already says what is being uploaded. */}
      <Button size="sm" className="shrink-0 gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <UploadIcon className="size-3.5" /> Upload
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
          <DialogDescription>
            Stored privately — visible only to this employee and to people with company-wide document access.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="document-file">File</Label>
            <Input id="document-file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="document-category">
              Category <span className="text-destructive">*</span>
            </Label>
            <Select items={DOCUMENT_CATEGORIES} value={category} onValueChange={(v) => setCategory(v ?? "")}>
              <SelectTrigger id="document-category" aria-label="Document category" className="w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isOther && (
            <div className="grid gap-1.5">
              <Label htmlFor="document-custom-category">
                Category name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="document-custom-category"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="e.g. Gym membership"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Shown in place of &quot;Other&quot; in the list.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button disabled={!canSubmit} onClick={handleSubmit}>
            {upload.isPending ? "Uploading…" : "Upload"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
