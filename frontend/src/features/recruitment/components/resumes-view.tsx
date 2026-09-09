"use client"

import { useState, useRef } from "react"
import { useResumes, useResumeMutations } from "../hooks"
import { ResumeDetailModal } from "./resume-detail-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  FileTextIcon,
  UploadCloudIcon,
  SearchIcon,
  RefreshCwIcon,
  DownloadIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  Trash2Icon,
  ExternalLinkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
} from "lucide-react"
import { recruitmentApi } from "../api"
import type { CandidateResumeSummary } from "@/types/recruitment"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

interface ResumesViewProps {
  onOpenCandidate?: (candidateId: string) => void
  initialStatus?: string
}

export function ResumesView({ onOpenCandidate, initialStatus = "" }: ResumesViewProps) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>(initialStatus)
  const [page, setPage] = useState(1)
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CandidateResumeSummary | null>(null)
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [bulkPending, setBulkPending] = useState(false)
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const canProcess = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.resumesProcess])
  const canManage = usePermission(PERMISSIONS.recruitmentManage)

  const { data: response, isLoading } = useResumes({
    search: search.trim() || undefined,
    status: status || undefined,
    page,
  })

  const { upload, reprocess, deleteResume } = useResumeMutations()

  const resumes = response?.data ?? []
  const meta = response?.meta

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSelectedFile(file)
  }

  const clearSelectedFile = () => {
    setSelectedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const handleUploadClick = async () => {
    if (!selectedFile) return

    setUploading(true)
    try {
      await upload.mutateAsync(selectedFile)
      toast.success("File uploaded successfully")
      clearSelectedFile()
    } catch (err: any) {
      toast.error(err?.message || "Failed to upload resume")
    } finally {
      setUploading(false)
    }
  }

  const handleReprocess = async (r: CandidateResumeSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await reprocess.mutateAsync(r.id)
      toast.success(`Re-queued ${r.fileName} for parsing`)
    } catch (err: any) {
      toast.error(err?.message || "Failed to reprocess resume")
    }
  }

  const handleDeleteClick = (r: CandidateResumeSummary, e: React.MouseEvent) => {
    e.stopPropagation()
    setPendingDelete(r)
  }

  const confirmDelete = async () => {
    if (!pendingDelete) return
    try {
      await deleteResume.mutateAsync(pendingDelete.id)
      toast.info("Resume deleted")
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete resume")
    } finally {
      setPendingDelete(null)
    }
  }

  function toggleChecked(id: string) {
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCheckAll() {
    const ids = resumes.map((r) => r.id)
    const allChecked = ids.length > 0 && ids.every((id) => checkedIds.has(id))
    setCheckedIds(allChecked ? new Set() : new Set(ids))
  }

  async function bulkReprocess() {
    if (checkedIds.size === 0) return
    setBulkPending(true)
    try {
      await Promise.all(Array.from(checkedIds).map((id) => reprocess.mutateAsync(id)))
      toast.success(`${checkedIds.size} resume(s) re-queued for parsing`)
      setCheckedIds(new Set())
    } catch (err: any) {
      toast.error(err?.message || "Failed to reprocess selected resumes")
    } finally {
      setBulkPending(false)
    }
  }

  async function confirmBulkDelete() {
    setBulkPending(true)
    try {
      await Promise.all(Array.from(checkedIds).map((id) => deleteResume.mutateAsync(id)))
      toast.info(`${checkedIds.size} resume(s) deleted`)
      setCheckedIds(new Set())
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete selected resumes")
    } finally {
      setBulkPending(false)
      setBulkDeleteConfirmOpen(false)
    }
  }

  const statusColors: Record<string, string> = {
    pending: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    processing: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    failed: "bg-red-500/10 text-red-600 border-red-500/30",
    not_a_resume: "bg-muted text-muted-foreground border-border",
    duplicate: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  }

  const statusPills = [
    { label: "All Resumes", value: "" },
    { label: "Completed", value: "completed" },
    { label: "Processing", value: "processing" },
    { label: "Needs Retry / Failed", value: "failed" },
    { label: "Not a Resume", value: "not_a_resume" },
    { label: "Duplicate", value: "duplicate" },
  ]

  return (
    <div className="space-y-4">
      {/* Upload Zone & Header */}
      {canProcess && (
      <div className="rounded-xl border-2 border-dashed p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 text-left">
          <div className="flex size-11 items-center justify-center rounded-xl bg-role-recruitment/12 text-role-recruitment">
            <UploadCloudIcon className="size-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Upload Candidate Resumes</h3>
            <p className="text-xs text-muted-foreground">
              Direct upload PDF, DOCX, or DOC. Ingests text deterministically, parses with Claude, and links candidate records.
            </p>
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.doc"
            onChange={handleFileSelect}
            className="hidden"
            id="resume-file-input"
          />

          {!selectedFile ? (
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs gap-1.5 shadow-2xs"
            >
              <UploadCloudIcon className="size-3.5" /> Choose Resume File
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex max-w-48 items-center gap-1.5 truncate rounded-md border bg-background px-2.5 py-1.5 text-xs text-foreground shadow-2xs">
                <FileTextIcon className="size-3.5 shrink-0 text-role-recruitment" />
                <span className="truncate">{selectedFile.name}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearSelectedFile}
                disabled={uploading}
                className="size-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                title="Remove selected file"
              >
                <XIcon className="size-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={handleUploadClick}
                disabled={uploading}
                className="shrink-0 text-xs gap-1.5 shadow-2xs"
              >
                {uploading ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin" /> Uploading...
                  </>
                ) : (
                  <>
                    <UploadCloudIcon className="size-3.5" /> Upload
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Filter Row */}
      <div className="space-y-3">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search resumes by filename or matched candidate name..."
            className="pl-8 text-xs h-9"
          />
        </div>

        {/* Status Tabs — active pill uses the same semantic color as its
            status badge on each resume row, instead of a uniform violet. */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b text-xs">
          {statusPills.map((p) => {
            const isActive = status === p.value
            const activeColor = p.value ? statusColors[p.value] : "bg-primary/10 text-primary border-primary/30"
            return (
            <button
              key={p.value}
              onClick={() => {
                setStatus(p.value)
                setPage(1)
              }}
              className={`rounded-md border px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? activeColor
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {p.label}
            </button>
            )
          })}
        </div>
      </div>

      {/* Resume List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-xs text-muted-foreground space-y-1.5">
          <FileTextIcon className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground text-sm">No resumes found</p>
          <p>Upload resumes directly above, or scan authorized Zoho Mailboxes.</p>
        </div>
      ) : (
        <div className="rounded-xl border shadow-2xs overflow-hidden">
          {canManage && checkedIds.size > 0 && (
            <div className="flex items-center justify-between gap-2 border-b bg-muted/30 px-4 py-2">
              <span className="text-xs font-medium text-foreground">{checkedIds.size} selected</span>
              <div className="flex items-center gap-1">
                {canProcess && (
                  <Button size="sm" variant="ghost" disabled={bulkPending} onClick={bulkReprocess} className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
                    <RefreshCwIcon className="size-3.5" /> Reprocess
                  </Button>
                )}
                <Button size="sm" variant="ghost" disabled={bulkPending} onClick={() => setBulkDeleteConfirmOpen(true)} className="h-7 text-xs gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10">
                  <Trash2Icon className="size-3.5" /> Delete
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setCheckedIds(new Set())} className="h-7 text-xs text-muted-foreground">
                  Clear
                </Button>
              </div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                {canManage && (
                  <TableHead className="w-8">
                    <input
                      type="checkbox"
                      checked={resumes.length > 0 && resumes.every((r) => checkedIds.has(r.id))}
                      onChange={toggleCheckAll}
                      className="size-4 cursor-pointer accent-primary"
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Candidate</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumes.map((resume) => (
                <TableRow
                  key={resume.id}
                  onClick={() => setSelectedResumeId(resume.id)}
                  className="cursor-pointer"
                >
                  {canManage && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={checkedIds.has(resume.id)}
                        onChange={() => toggleChecked(resume.id)}
                        className="size-4 cursor-pointer accent-primary"
                        aria-label={`Select ${resume.fileName}`}
                      />
                    </TableCell>
                  )}
                  <TableCell>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <FileTextIcon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground text-xs max-w-xs">{resume.fileName}</p>
                        {resume.errorMessage && (
                          <p className="truncate text-[11px] text-destructive max-w-xs">Error: {resume.errorMessage}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${
                        statusColors[resume.processingStatus] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {resume.processingStatus === "processing" && (
                        <Loader2Icon className="size-2.5 animate-spin" />
                      )}
                      {resume.processingStatus === "completed" && (
                        <CheckCircle2Icon className="size-2.5 text-emerald-500" />
                      )}
                      {resume.processingStatus === "failed" && (
                        <AlertCircleIcon className="size-2.5 text-red-500" />
                      )}
                      {resume.processingStatus.replace("_", " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{resume.candidateName || "—"}</TableCell>
                  <TableCell className="text-muted-foreground capitalize">{resume.source.replace("_", " ")}</TableCell>
                  <TableCell className="text-muted-foreground">{(resume.fileSize / 1024).toFixed(1)} KB</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(resume.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      {canProcess && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => handleReprocess(resume, e)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Reprocess resume"
                        >
                          <RefreshCwIcon className="size-3.5" />
                        </Button>
                      )}
                      {resume.hasFile && (
                        <a
                          href={recruitmentApi.resumes.downloadUrl(resume.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-role-recruitment hover:bg-muted transition-colors"
                          title="Download original resume"
                        >
                          <DownloadIcon className="size-3.5" />
                        </a>
                      )}
                      {canManage && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={(e) => handleDeleteClick(resume, e)}
                          className="text-muted-foreground hover:text-destructive"
                          title="Delete resume"
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
          <span>
            Showing page {meta.page} of {meta.totalPages} ({meta.totalCount} resumes)
          </span>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.max(p - 1, 1))}
              disabled={page <= 1}
              className="h-8 text-xs gap-1"
            >
              <ChevronLeftIcon className="size-3.5" /> Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage((p) => Math.min(p + 1, meta.totalPages))}
              disabled={page >= meta.totalPages}
              className="h-8 text-xs gap-1"
            >
              Next <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      <ResumeDetailModal
        resumeId={selectedResumeId}
        open={!!selectedResumeId}
        onOpenChange={(open) => !open && setSelectedResumeId(null)}
        onOpenCandidate={onOpenCandidate}
      />

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete resume?</DialogTitle>
            <DialogDescription>
              {pendingDelete && (
                <>
                  This will permanently delete <span className="font-medium text-foreground">{pendingDelete.fileName}</span>.
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteResume.isPending}
              className="gap-1.5"
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkDeleteConfirmOpen} onOpenChange={(open) => !open && setBulkDeleteConfirmOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {checkedIds.size} resume{checkedIds.size === 1 ? "" : "s"}?</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected resumes. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </DialogClose>
            <Button
              type="button"
              size="sm"
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={bulkPending}
              className="gap-1.5"
            >
              <Trash2Icon className="size-3.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
