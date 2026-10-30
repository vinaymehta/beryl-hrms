"use client"

import { use } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { feedbackApi } from "@/features/recruitment/api"
import { InterviewFeedbackForm } from "@/features/recruitment/components/interview-feedback-form"
import { InterviewFeedbackDetails } from "@/features/recruitment/components/interview-feedback"
import { formatIst } from "@/features/recruitment/lib/interview-feedback"
import type { InterviewFeedbackInput } from "@/types/recruitment"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2Icon, AlertCircleIcon, CalendarClockIcon } from "lucide-react"

/**
 * PUBLIC page — the INTERVIEWER writes up the candidate they interviewed, with
 * no login (per spec). The token in the URL is the only credential, so the page
 * is standalone: no app shell, no nav, and nothing about the candidate beyond
 * who they are and when the interview was.
 */
export default function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["feedback", token],
    queryFn: () => feedbackApi.get(token),
    retry: false,
  })

  const submit = useMutation({
    mutationFn: (values: InterviewFeedbackInput) => feedbackApi.submit(token, values),
  })

  // Wrong link or revoked — same message either way, so the page never
  // confirms whether a given token exists.
  if (isError) {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <AlertCircleIcon className="mx-auto size-10 text-muted-foreground/40" />
          <h1 className="text-lg font-semibold text-foreground">This feedback link isn&apos;t valid</h1>
          <p className="text-sm text-muted-foreground">
            It may have expired or been mistyped. Try opening the link again directly from the email you received.
          </p>
        </div>
      </Shell>
    )
  }

  if (isLoading || !data) {
    return (
      <Shell>
        <div className="space-y-4">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </Shell>
    )
  }

  // Covers both "just submitted" and "opened the link again later" — the
  // backend refuses a second submission, so the page must not offer one.
  if (data.submitted || submit.isSuccess) {
    const saved = submit.data ?? data
    return (
      <Shell>
        <div className="space-y-4">
          <div className="space-y-2 text-center">
            <CheckCircle2Icon className="mx-auto size-10 text-success" />
            <h1 className="text-lg font-semibold text-foreground">Thank you</h1>
            <p className="text-sm text-muted-foreground">Your feedback on {data.candidateName} has been recorded.</p>
          </div>
          {saved.feedback.overallRating != null && (
            <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What you submitted</p>
              <InterviewFeedbackDetails feedback={saved.feedback} />
            </div>
          )}
        </div>
      </Shell>
    )
  }

  const when = formatIst(data.interviewAt)

  return (
    <Shell>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {data.companyName || "Interview feedback"}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            How did {data.candidateName} do?
          </h1>
          <p className="text-sm text-muted-foreground">
            {data.interviewerName ? `${data.interviewerName}, this` : "This"} takes a few minutes. Your assessment is
            recorded against the candidate and is not shared with them.
          </p>
          {when && (
            <p className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
              <CalendarClockIcon className="size-3.5" />
              Interviewed {when} (IST)
            </p>
          )}
        </div>

        <InterviewFeedbackForm
          onSubmit={(values) => submit.mutate(values)}
          isPending={submit.isPending}
          error={submit.isError ? submit.error : null}
        />
      </div>
    </Shell>
  )
}

// Standalone frame — this page is outside the dashboard layout on purpose.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-xl rounded-2xl border bg-background p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  )
}
