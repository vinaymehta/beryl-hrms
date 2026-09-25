"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CopyIcon,
  MessageSquareTextIcon,
  RefreshCwIcon,
  SparklesIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { recruitmentApi } from "@/features/recruitment/api"
import { ApiError } from "@/types/api"
import type { InterviewQuestion, InterviewQuestionSet } from "@/types/recruitment"

/** The five areas the prompt asks for, in the order an interview runs. */
const AREAS: { key: InterviewQuestion["area"]; label: string; tone: string }[] = [
  { key: "experience", label: "Their experience", tone: "bg-sky-500/10 text-sky-600" },
  { key: "technical", label: "Technical depth", tone: "bg-violet-500/10 text-violet-600" },
  { key: "role_fit", label: "Fit for the role", tone: "bg-amber-500/10 text-amber-600" },
  { key: "behavioural", label: "Behavioural", tone: "bg-emerald-500/10 text-emerald-600" },
  { key: "closing", label: "Closing", tone: "bg-slate-500/10 text-slate-600" },
]

function asPlainText(set: InterviewQuestionSet) {
  return AREAS.flatMap(({ key, label }) => {
    const rows = set.questions.filter((q) => q.area === key)
    if (rows.length === 0) return []
    return [`## ${label}`, ...rows.map((q, i) => `${i + 1}. ${q.question}`), ""]
  }).join("\n")
}

/**
 * Twenty AI-written interview questions for one shortlisted candidate.
 *
 * Reading is free and generating is not, so the two are separate: opening this
 * only fetches what is already stored, and the AI is called when — and only
 * when — somebody presses the button. The set is then saved, so the next
 * interviewer to open it sees the same questions rather than a fresh and
 * subtly different list.
 *
 * Copy produces plain text with the area headings intact, because the thing
 * people actually do with these is paste them into a notes doc or a calendar
 * invite before the call.
 */
export function InterviewQuestionsDialog({
  candidateId,
  candidateName,
  open,
  onOpenChange,
  canGenerate,
}: {
  candidateId: string
  candidateName: string
  open: boolean
  onOpenChange: (next: boolean) => void
  canGenerate: boolean
}) {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const queryKey = ["recruitment", "interview-questions", candidateId]
  const stored = useQuery({
    queryKey,
    queryFn: () => recruitmentApi.candidates.interviewQuestions(candidateId),
    // Nothing to fetch until the dialog is actually open.
    enabled: open,
  })

  const generate = useMutation({
    mutationFn: () => recruitmentApi.candidates.generateInterviewQuestions(candidateId),
    onSuccess: (set) => {
      queryClient.setQueryData(queryKey, set)
      toast.success(`${set.questions.length} questions ready.`)
    },
    onError: (error) =>
      toast.error(
        error instanceof ApiError ? error.message : "Couldn't generate questions. Try again."
      ),
  })

  const set = stored.data
  const hasQuestions = (set?.questions.length ?? 0) > 0

  async function copyAll() {
    if (!set) return
    try {
      await navigator.clipboard.writeText(asPlainText(set))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy to the clipboard.")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* sm:max-w-3xl, not max-w-3xl: DialogContent's own default ends in
          `sm:max-w-sm`, which otherwise wins at every width above mobile and
          squeezes twenty questions into a 24rem column.

          flex-col rather than the default grid, because the list has to
          scroll: a grid row sizes to its content, so `overflow-y-auto` on it
          has no height to scroll within and the popup just grows past
          max-h-[85vh] instead. */}
      <DialogContent className="flex max-h-[85vh] w-full flex-col overflow-hidden sm:max-w-3xl">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareTextIcon className="size-4 text-role-recruitment" />
            Interview questions
          </DialogTitle>
          <DialogDescription>
            For {candidateName}
            {set?.job ? ` · ${set.job.title}` : ""}
            {set?.generatedAt
              ? ` · generated ${new Date(set.generatedAt).toLocaleString()}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b pb-3">
          {canGenerate && (
            <Button
              size="sm"
              variant={hasQuestions ? "outline" : "default"}
              className="gap-1.5"
              disabled={generate.isPending}
              onClick={() => generate.mutate()}
            >
              {hasQuestions ? (
                <RefreshCwIcon className={generate.isPending ? "size-3.5 animate-spin" : "size-3.5"} />
              ) : (
                <SparklesIcon className="size-3.5" />
              )}
              {generate.isPending
                ? "Writing questions…"
                : hasQuestions
                  ? "Regenerate"
                  : "Generate 20 questions"}
            </Button>
          )}
          {hasQuestions && (
            <Button size="sm" variant="outline" className="gap-1.5" onClick={copyAll}>
              <CopyIcon className="size-3.5" />
              {copied ? "Copied" : "Copy all"}
            </Button>
          )}
        </div>

        {/* min-h-0 is what actually lets this shrink below its content and
            therefore scroll — without it a flex child refuses to go smaller
            than its intrinsic height. */}
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {stored.isPending && (
            <div className="grid gap-2 py-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}

          {stored.isError && (
            <p className="flex items-center gap-2 py-6 text-sm text-destructive">
              <TriangleAlertIcon className="size-4" />
              Couldn&apos;t load these questions.
            </p>
          )}

          {/* Generating takes a while and replaces the list wholesale, so the
              old set is hidden rather than left on screen looking current. */}
          {generate.isPending && (
            <div className="grid gap-2 py-4">
              <p className="text-xs text-muted-foreground">
                Reading the resume and writing questions. This takes a few seconds.
              </p>
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          )}

          {!stored.isPending && !stored.isError && !generate.isPending && !hasQuestions && (
            <div className="grid gap-2 py-8 text-center">
              <p className="text-sm font-medium">No questions yet</p>
              <p className="text-xs text-muted-foreground">
                {canGenerate
                  ? "Generate a set tailored to this candidate's resume and the role they're up for."
                  : "Nobody has generated a set for this candidate yet."}
              </p>
            </div>
          )}

          {!generate.isPending && hasQuestions && (
            <div className="grid gap-5 py-1">
              {AREAS.map(({ key, label, tone }) => {
                const rows = set!.questions.filter((q) => q.area === key)
                if (rows.length === 0) return null

                return (
                  <section key={key} className="grid gap-2">
                    <Badge className={`w-fit ${tone}`}>{label}</Badge>
                    <ol className="grid gap-2.5">
                      {rows.map((q, index) => (
                        <li key={`${key}-${index}`} className="grid gap-0.5">
                          <p className="text-sm text-foreground">
                            <span className="mr-1.5 text-muted-foreground tabular-nums">
                              {index + 1}.
                            </span>
                            {q.question}
                          </p>
                          {q.whyItMatters && (
                            <p className="pl-5 text-xs text-muted-foreground italic">
                              {q.whyItMatters}
                            </p>
                          )}
                        </li>
                      ))}
                    </ol>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
