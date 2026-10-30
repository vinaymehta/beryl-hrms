"use client"

import { useState, type MouseEvent, type ReactNode } from "react"
import { toast } from "sonner"
import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CheckCircle2Icon,
  ClipboardListIcon,
  ClockIcon,
  FileDownIcon,
  VideoIcon,
} from "lucide-react"
import { myInterviewsApi } from "../api"
import { useMyInterviews, useSubmitMyInterviewFeedback } from "../hooks"
import { InterviewFeedbackDetails } from "./interview-feedback"
import { InterviewFeedbackForm } from "./interview-feedback-form"
import { CandidateProfileFacts, InterviewQuestionsSection, OverviewSection } from "./interview-overview"
import { DECISION_META, experienceLine, formatIst, relativeTime } from "../lib/interview-feedback"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import type { InterviewStatus, MyInterview } from "@/types/recruitment"
import { cn } from "cn"

const SECTIONS: { status: InterviewStatus; title: string; empty: string; icon: typeof ClockIcon }[] = [
  { status: "feedback_pending", title: "Feedback pending", empty: "Nothing to write up.", icon: ClockIcon },
  { status: "upcoming", title: "Upcoming", empty: "No interviews booked with you.", icon: CalendarClockIcon },
  { status: "feedback_received", title: "Submitted", empty: "No feedback submitted yet.", icon: CheckCircle2Icon },
]

function InterviewCard({ interview, onOpen }: { interview: MyInterview; onOpen: () => void }) {
  const decision = interview.feedback.decision ? DECISION_META[interview.feedback.decision] : null
  const when = formatIst(interview.interviewAt)
  // Buttons inside the clickable card must not also open the panel.
  const stop = (e: MouseEvent) => e.stopPropagation()

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && e.target === e.currentTarget && onOpen()}
      className="flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 shadow-2xs transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-semibold text-foreground">{interview.candidateName}</p>
        <p className="truncate text-xs text-foreground/80">
          {interview.jobTitle ? `Applied for ${interview.jobTitle}` : "Role not recorded"}
        </p>
        <p className="truncate text-xs text-muted-foreground">{experienceLine(interview.profile)}</p>
        <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <CalendarClockIcon className="size-3.5" />
          {when ? `${when} IST` : "Time not set"}
          {interview.interviewAt && <span className="text-muted-foreground/80">· {relativeTime(interview.interviewAt)}</span>}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" onClick={stop}>
        {decision && (
          <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", decision.className)}>
            {decision.label}
          </span>
        )}
        <InterviewLinks interview={interview} />
        {interview.interviewStatus === "feedback_pending" && (
          <Button size="sm" className="gap-1.5" onClick={onOpen}>
            <ClipboardListIcon className="size-3.5" />
            Write feedback
          </Button>
        )}
        {interview.interviewStatus === "feedback_received" && (
          <Button size="sm" variant="outline" onClick={onOpen}>
            View feedback
          </Button>
        )}
      </div>
    </div>
  )
}

/** Join (until the write-up is in) and the resume. */
function InterviewLinks({ interview }: { interview: MyInterview }) {
  return (
    <>
      {interview.joinUrl && interview.interviewStatus !== "feedback_received" && (
        <Button size="sm" variant="outline" className="gap-1.5" nativeButton={false} render={<a href={interview.joinUrl} target="_blank" rel="noreferrer" />}>
          <VideoIcon className="size-3.5" />
          Join
        </Button>
      )}
      {interview.hasResume && (
        <Button size="sm" variant="outline" className="gap-1.5" nativeButton={false} render={<a href={myInterviewsApi.resumeUrl(interview.id)} />}>
          <FileDownIcon className="size-3.5" />
          Resume
        </Button>
      )}
    </>
  )
}

/**
 * The signed-in user's own interviews — nothing else. Pending write-ups first,
 * since that's what this page is for; the form is the same one the emailed
 * link opens, and the feedback can be submitted once from either.
 */
export function MyInterviewsView({ tabs }: { tabs?: ReactNode }) {
  const { data, isLoading } = useMyInterviews()
  const submit = useSubmitMyInterviewFeedback()
  const [openId, setOpenId] = useState<string | null>(null)

  const interviews = data ?? []
  const open = interviews.find((i) => i.id === openId) ?? null

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-role-recruitment/12 text-role-recruitment">
            <CalendarCheckIcon className="size-7" />
          </span>
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-foreground">My interviews</h2>
            <p className="text-sm text-muted-foreground">Interviews you&apos;re running, and your feedback on them</p>
          </div>
        </div>
        {tabs}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : interviews.length === 0 ? (
        <div className="space-y-2 rounded-xl border border-dashed p-12 text-center">
          <CalendarClockIcon className="mx-auto size-8 text-muted-foreground/40" />
          <p className="text-sm font-semibold text-foreground">No interviews assigned to you</p>
          <p className="text-xs text-muted-foreground">When you&apos;re picked to interview a candidate, it shows up here.</p>
        </div>
      ) : (
        SECTIONS.map((section) => {
          const items = interviews.filter((i) => i.interviewStatus === section.status)
          // Soonest first for upcoming; most recent first otherwise.
          if (section.status === "upcoming") items.reverse()
          return (
            <section key={section.status} className="space-y-3">
              <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <section.icon className="size-3.5" />
                {section.title}
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{items.length}</span>
              </h3>
              {items.length === 0 ? (
                <p className="text-xs text-muted-foreground">{section.empty}</p>
              ) : (
                <div className="space-y-2">
                  {items.map((interview) => (
                    <InterviewCard key={interview.id} interview={interview} onOpen={() => setOpenId(interview.id)} />
                  ))}
                </div>
              )}
            </section>
          )
        })
      )}

      <Sheet
        open={!!open}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setOpenId(null)
            submit.reset()
          }
        }}
      >
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <SheetHeader className="space-y-1 border-b pr-12">
                <SheetTitle>{open.candidateName}</SheetTitle>
                <SheetDescription>{open.jobTitle ? `Applied for ${open.jobTitle}` : "Role not recorded"}</SheetDescription>
                <p className="flex flex-wrap items-center gap-x-1.5 pt-1 text-[11px] text-muted-foreground">
                  <CalendarClockIcon className="size-3.5" />
                  {open.interviewAt ? `${formatIst(open.interviewAt)} IST · ${relativeTime(open.interviewAt)}` : "Time not set"}
                </p>
              </SheetHeader>
              <div className="space-y-6 px-4 pt-4 pb-6">
                {(open.hasResume || (open.joinUrl && open.interviewStatus !== "feedback_received")) && (
                  <div className="flex flex-wrap gap-2">
                    <InterviewLinks interview={open} />
                  </div>
                )}

                <OverviewSection title="Candidate">
                  <CandidateProfileFacts profile={open.profile} />
                </OverviewSection>

                <InterviewQuestionsSection questions={open.interviewQuestions} />

                {open.feedback.submittedAt ? (
                  <OverviewSection title="Your feedback">
                    <InterviewFeedbackDetails feedback={open.feedback} />
                  </OverviewSection>
                ) : open.interviewStatus === "upcoming" ? (
                  <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
                    The feedback form opens here once the interview has happened.
                  </p>
                ) : (
                  <div className="border-t pt-5">
                    <InterviewFeedbackForm
                      // A fresh form per candidate, so answers never carry over.
                      key={open.id}
                      isPending={submit.isPending}
                      error={submit.isError ? submit.error : null}
                      onSubmit={(values) =>
                        submit.mutate(
                          { id: open.id, values },
                          {
                            onSuccess: () => {
                              toast.success(`Feedback on ${open.candidateName} submitted`)
                              setOpenId(null)
                            },
                          }
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
