"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { ChevronDownIcon, CopyIcon, ExternalLinkIcon, MessageSquareTextIcon } from "lucide-react"
import { AREAS } from "./interview-questions-dialog"
import { INTERVIEW_STAGE_META } from "../lib/interview-feedback"
import { Button } from "@/components/ui/button"
import type { InterviewCandidateProfile, InterviewQuestion, InterviewStage } from "@/types/recruitment"
import { cn } from "cn"

/*
 * The pieces both interview side panels are built from — the admin overview
 * on the Interviews dashboard and the interviewer's own on My interviews — so
 * a candidate reads the same in either.
 */

export function StageBadge({ stage }: { stage: InterviewStage }) {
  const meta = INTERVIEW_STAGE_META[stage]
  return (
    <span className={cn("inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", meta.className)}>
      {meta.label}
    </span>
  )
}

export function OverviewSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}

/** One label/value line; renders nothing when there's no value. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  if (children == null || children === "") return null
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-2 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children}</dd>
    </div>
  )
}

/** Experience, current job, location, education and skills. */
export function CandidateProfileFacts({ profile, children }: { profile: InterviewCandidateProfile; children?: ReactNode }) {
  const years = profile.experienceYears
  const current = [profile.currentRole, profile.currentCompany].filter(Boolean).join(" at ")

  return (
    <div className="space-y-3">
      <dl className="space-y-1.5">
        <Fact label="Experience">{`${years} yr${years === 1 ? "" : "s"}`}</Fact>
        <Fact label="Current">{current || null}</Fact>
        <Fact label="Location">{profile.location}</Fact>
        <Fact label="Education">{profile.education}</Fact>
        {children}
      </dl>
      {profile.skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {profile.skills.map((skill) => (
            <span key={skill} className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-[11px] text-foreground/80">
              {skill}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/** The meeting link, with copy and open. */
export function JoinLink({ url }: { url: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      toast.success("Join link copied")
    } catch {
      toast.error("Couldn't copy to the clipboard.")
    }
  }

  return (
    <div className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 truncate text-primary">{url}</span>
      <Button size="icon-xs" variant="ghost" aria-label="Copy join link" onClick={copy}>
        <CopyIcon />
      </Button>
      <Button
        size="icon-xs"
        variant="ghost"
        aria-label="Open join link"
        nativeButton={false}
        render={<a href={url} target="_blank" rel="noreferrer" />}
      >
        <ExternalLinkIcon />
      </Button>
    </div>
  )
}

/** The AI-written questions, folded away until wanted. */
export function InterviewQuestionsSection({ questions }: { questions: InterviewQuestion[] }) {
  const [open, setOpen] = useState(false)
  if (questions.length === 0) return null

  return (
    <section className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="inline-flex items-center gap-2 text-xs font-semibold text-foreground">
          <MessageSquareTextIcon className="size-3.5 text-role-recruitment" />
          AI interview questions
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{questions.length}</span>
        </span>
        <ChevronDownIcon className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="space-y-4 border-t px-3 py-3">
          {AREAS.map(({ key, label }) => {
            const rows = questions.filter((q) => q.area === key)
            if (rows.length === 0) return null
            return (
              <div key={key} className="space-y-1.5">
                <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
                <ol className="space-y-2">
                  {rows.map((q, index) => (
                    <li key={`${key}-${index}`} className="space-y-0.5">
                      <p className="text-xs text-foreground">
                        <span className="mr-1.5 text-muted-foreground tabular-nums">{index + 1}.</span>
                        {q.question}
                      </p>
                      {q.whyItMatters && <p className="pl-4 text-[11px] text-muted-foreground italic">{q.whyItMatters}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
