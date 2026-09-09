"use client"

import { useState } from "react"
import { useResume, useResumeMutations } from "../hooks"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  FileTextIcon,
  RefreshCwIcon,
  DownloadIcon,
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  SparklesIcon,
  BrainIcon,
  CodeIcon,
} from "lucide-react"
import { recruitmentApi } from "../api"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"

interface ResumeDetailModalProps {
  resumeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenCandidate?: (candidateId: string) => void
}

export function ResumeDetailModal({
  resumeId,
  open,
  onOpenChange,
  onOpenCandidate,
}: ResumeDetailModalProps) {
  const { data: resume, isLoading } = useResume(resumeId || "")
  const { reprocess } = useResumeMutations()
  const [activeTab, setActiveTab] = useState<"extracted" | "raw" | "metadata">("extracted")
  const canProcess = usePermission([PERMISSIONS.recruitmentManage, PERMISSIONS.resumesProcess])

  if (!resumeId) return null

  const handleReprocess = async () => {
    try {
      await reprocess.mutateAsync(resumeId)
      toast.success("Resume re-queued for AI parsing")
    } catch (err: any) {
      toast.error(err?.message || "Failed to reprocess resume")
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        {isLoading || !resume ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="border-b p-5 pr-12 bg-muted/20 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileTextIcon className="size-4 text-role-recruitment" />
                    <DialogTitle className="text-base font-bold text-foreground break-all">
                      {resume.fileName}
                    </DialogTitle>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                        statusColors[resume.processingStatus] || "bg-muted text-muted-foreground"
                      }`}
                    >
                      {resume.processingStatus.replace("_", " ")}
                    </span>
                  </div>

                  <DialogDescription className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span>Source: {resume.source.replace("_", " ")}</span>
                    <span>•</span>
                    <span>{(resume.fileSize / 1024).toFixed(1)} KB</span>
                    <span>•</span>
                    <span>Uploaded {new Date(resume.createdAt).toLocaleString()}</span>
                  </DialogDescription>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {canProcess && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleReprocess}
                      disabled={reprocess.isPending}
                      className="h-8 text-xs gap-1"
                    >
                      <RefreshCwIcon className={`size-3.5 ${reprocess.isPending ? "animate-spin" : ""}`} />
                      Reprocess
                    </Button>
                  )}

                  {resume.hasFile && (
                    <a
                      href={recruitmentApi.resumes.downloadUrl(resume.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 shadow-2xs transition-colors"
                    >
                      <DownloadIcon className="size-3.5" />
                      Download
                    </a>
                  )}
                </div>
              </div>

              {resume.errorMessage && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive flex items-start gap-2">
                  <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Processing Failure</p>
                    <p className="text-[11px] leading-relaxed">{resume.errorMessage}</p>
                  </div>
                </div>
              )}

              {/* Linked Candidate Preview */}
              {resume.candidate && (
                <div className="flex items-center justify-between rounded-lg border bg-background p-2.5 text-xs shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    <div>
                      <p className="font-semibold text-foreground">
                        Matched Candidate: {resume.candidate.fullName}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {resume.candidate.currentRole || "Candidate"} • {resume.candidate.city || "Location not set"}
                      </p>
                    </div>
                  </div>

                  {onOpenCandidate && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        onOpenChange(false)
                        onOpenCandidate(resume.candidate!.id)
                      }}
                      className="h-7 text-xs text-muted-foreground hover:text-foreground"
                    >
                      Open Profile →
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Content Tabs */}
            <div className="border-b px-5 flex items-center gap-2 text-xs pt-2">
              <button
                onClick={() => setActiveTab("extracted")}
                className={`pb-2 font-medium border-b-2 transition-colors ${
                  activeTab === "extracted"
                    ? "border-role-recruitment text-role-recruitment"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Extracted JSON Data
              </button>
              <button
                onClick={() => setActiveTab("raw")}
                className={`pb-2 font-medium border-b-2 transition-colors ${
                  activeTab === "raw"
                    ? "border-role-recruitment text-role-recruitment"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Deterministic Raw Text
              </button>
              <button
                onClick={() => setActiveTab("metadata")}
                className={`pb-2 font-medium border-b-2 transition-colors ${
                  activeTab === "metadata"
                    ? "border-role-recruitment text-role-recruitment"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                AI Provenance & Metadata
              </button>
            </div>

            {/* Tab Views */}
            <div className="p-5 text-xs">
              {activeTab === "extracted" && (
                <div className="space-y-3">
                  {resume.extractedData ? (
                    <pre className="rounded-lg border bg-muted/40 p-3.5 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[350px]">
                      {JSON.stringify(resume.extractedData, null, 2)}
                    </pre>
                  ) : (
                    <p className="text-muted-foreground">No extracted structured data available yet.</p>
                  )}
                </div>
              )}

              {activeTab === "raw" && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-[11px]">
                    Extracted deterministically from document binary before AI prompt execution.
                  </p>
                  <pre className="rounded-lg border bg-muted/40 p-3.5 font-mono text-[11px] whitespace-pre-wrap leading-relaxed overflow-y-auto max-h-[350px]">
                    {resume.rawText || "No text extracted."}
                  </pre>
                </div>
              )}

              {activeTab === "metadata" && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border p-2.5 bg-card space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Provider</span>
                      <p className="font-semibold text-foreground">{resume.aiMetadata?.provider || "Anthropic Claude"}</p>
                    </div>

                    <div className="rounded-lg border p-2.5 bg-card space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Active Model</span>
                      <p className="font-semibold text-foreground">{resume.aiMetadata?.model || "Configured Claude / Mock"}</p>
                    </div>

                    <div className="rounded-lg border p-2.5 bg-card space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Prompt Version</span>
                      <p className="font-semibold text-foreground">{resume.aiMetadata?.prompt_version || "v1"}</p>
                    </div>

                    <div className="rounded-lg border p-2.5 bg-card space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">Processed At</span>
                      <p className="font-semibold text-foreground">
                        {resume.processedAt ? new Date(resume.processedAt).toLocaleString() : "Pending"}
                      </p>
                    </div>
                  </div>

                  {resume.fileHash && (
                    <div className="rounded-lg border p-2.5 bg-muted/20 space-y-0.5">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase">SHA-256 Fingerprint</span>
                      <p className="font-mono text-[10px] text-muted-foreground break-all">{resume.fileHash}</p>
                    </div>
                  )}

                  {resume.provenanceData && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[11px] font-semibold text-foreground">Confidence & Provenance Map</span>
                      <pre className="rounded-lg border bg-muted/40 p-2.5 font-mono text-[10px] overflow-x-auto max-h-40">
                        {JSON.stringify(resume.provenanceData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
