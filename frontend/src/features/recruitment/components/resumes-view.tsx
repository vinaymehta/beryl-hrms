"use client"

import { useState, useRef } from "react"
import { useResumes, useResumeMutations } from "../hooks"
import { ResumeDetailModal } from "./resume-detail-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
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
}

export function ResumesView({ onOpenCandidate }: ResumesViewProps) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState<string>("")
  const [page, setPage] = useState(1)
  const [selectedResumeId, setSelectedResumeId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [pendingDelete, setPendingDelete] = useState<CandidateResumeSummary | null>(null)
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

        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 border-b text-xs">
          {statusPills.map((p) => (
            <button
              key={p.value}
              onClick={() => {
                setStatus(p.value)
                setPage(1)
              }}
              className={`rounded-md px-3 py-1.5 font-medium whitespace-nowrap transition-colors ${
                status === p.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Resume List */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : resumes.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-xs text-muted-foreground space-y-1.5">
          <FileTextIcon className="size-8 text-muted-foreground/40 mx-auto" />
          <p className="font-semibold text-foreground text-sm">No resumes found</p>
          <p>Upload resumes directly above, or scan authorized Zoho Mailboxes.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {resumes.map((resume) => (
            <Card
              key={resume.id}
              onClick={() => setSelectedResumeId(resume.id)}
              className="cursor-pointer hover:border-role-recruitment/40 transition-colors shadow-2xs group"
            >
              <CardContent className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground mt-0.5">
                    <FileTextIcon className="size-4" />
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-xs text-foreground truncate max-w-xs sm:max-w-md">
                        {resume.fileName}
                      </p>

                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
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
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>Source: {resume.source.replace("_", " ")}</span>
                      <span>•</span>
                      <span>{(resume.fileSize / 1024).toFixed(1)} KB</span>
                      <span>•</span>
                      <span>{new Date(resume.createdAt).toLocaleDateString()}</span>
                      {resume.candidateName && (
                        <>
                          <span>•</span>
                          <span className="font-medium text-foreground">
                            Candidate: {resume.candidateName}
                          </span>
                        </>
                      )}
                    </div>

                    {resume.errorMessage && (
                      <p className="text-[11px] text-destructive truncate max-w-md">
                        Error: {resume.errorMessage}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {canProcess && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleReprocess(resume, e)}
                      className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
                      title="Reprocess resume"
                    >
                      <RefreshCwIcon className="size-3.5" />
                      <span className="hidden sm:inline">Reprocess</span>
                    </Button>
                  )}

                  {resume.hasFile && (
                    <a
                      href={recruitmentApi.resumes.downloadUrl(resume.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center justify-center size-8 rounded-md border bg-background text-muted-foreground hover:text-role-recruitment transition-colors shadow-2xs"
                      title="Download original resume"
                    >
                      <DownloadIcon className="size-3.5" />
                    </a>
                  )}

                  {canManage && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => handleDeleteClick(resume, e)}
                      className="size-8 p-0 text-muted-foreground hover:text-destructive"
                      title="Delete resume"
                    >
                      <Trash2Icon className="size-3.5" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
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
    </div>
  )
}
