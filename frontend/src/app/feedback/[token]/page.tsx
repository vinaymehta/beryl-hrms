"use client"

import { use, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { feedbackApi } from "@/features/recruitment/api"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { CheckCircle2Icon, StarIcon, MessageSquareIcon, AlertCircleIcon } from "lucide-react"
import { cn } from "cn"

const RATING_LABELS = ["Poor", "Fair", "Good", "Great", "Excellent"]

/**
 * PUBLIC page — the candidate has no account here. The token in the URL is the
 * only credential, so this page is deliberately standalone: no app shell, no
 * nav, nothing about their application, their status, or who interviewed them.
 */
export default function FeedbackPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["feedback", token],
    queryFn: () => feedbackApi.get(token),
    retry: false,
  })

  const [rating, setRating] = useState(0)
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null)
  const [comments, setComments] = useState("")

  const submit = useMutation({
    mutationFn: () => feedbackApi.submit(token, { rating, wouldRecommend, comments }),
  })

  // Either the link is wrong or it was revoked — same message either way, so
  // the page never confirms whether a given token exists.
  if (isError) {
    return (
      <Shell>
        <div className="space-y-3 text-center">
          <AlertCircleIcon className="mx-auto size-10 text-muted-foreground/40" />
          <h1 className="text-lg font-semibold text-foreground">This feedback link isn&apos;t valid</h1>
          <p className="text-sm text-muted-foreground">
            It may have expired or been mistyped. If you received it by email, try opening the link again directly from
            that message.
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
        <div className="space-y-4 text-center">
          <CheckCircle2Icon className="mx-auto size-10 text-emerald-500" />
          <h1 className="text-lg font-semibold text-foreground">Thank you{data.candidateFirstName ? `, ${data.candidateFirstName}` : ""}</h1>
          <p className="text-sm text-muted-foreground">
            Your feedback has been recorded. We appreciate you taking the time.
          </p>
          {saved.rating != null && (
            <div className="rounded-lg border bg-muted/20 p-4 text-left text-sm space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What you told us</p>
              <p className="text-foreground">
                Overall: <strong>{saved.rating}/5</strong>
                {RATING_LABELS[saved.rating - 1] ? ` — ${RATING_LABELS[saved.rating - 1]}` : ""}
              </p>
              {saved.wouldRecommend != null && (
                <p className="text-foreground">
                  Would recommend us to others: <strong>{saved.wouldRecommend ? "Yes" : "No"}</strong>
                </p>
              )}
              {saved.comments && <p className="whitespace-pre-wrap text-muted-foreground">{saved.comments}</p>}
            </div>
          )}
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div className="space-y-6">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {data.companyName || "Interview feedback"}
          </p>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            How was your interview{data.candidateFirstName ? `, ${data.candidateFirstName}` : ""}?
          </h1>
          <p className="text-sm text-muted-foreground">
            This takes about a minute. Your answers help us improve the experience for everyone we speak to.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Overall experience</Label>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                aria-label={`${n} out of 5 — ${RATING_LABELS[n - 1]}`}
                aria-pressed={rating === n}
                className={cn(
                  "flex size-11 items-center justify-center rounded-lg border transition-colors",
                  n <= rating
                    ? "border-amber-500/40 bg-amber-500/10 text-amber-500"
                    : "text-muted-foreground/40 hover:bg-muted/50"
                )}
              >
                <StarIcon className={cn("size-5", n <= rating && "fill-current")} />
              </button>
            ))}
          </div>
          <p className="h-4 text-xs text-muted-foreground">{rating > 0 ? RATING_LABELS[rating - 1] : ""}</p>
        </div>

        <div className="space-y-2">
          <Label>Would you recommend interviewing here to others?</Label>
          <div className="flex items-center gap-2">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
            ].map((opt) => (
              <button
                key={opt.label}
                type="button"
                onClick={() => setWouldRecommend(opt.value)}
                aria-pressed={wouldRecommend === opt.value}
                className={cn(
                  "rounded-lg border px-5 py-2 text-sm font-medium transition-colors",
                  wouldRecommend === opt.value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="comments">Anything else you&apos;d like to share?</Label>
          <textarea
            id="comments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="What went well, and what could we have done better?"
            className="w-full resize-y rounded-lg border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <p className="text-xs text-muted-foreground">Optional — {2000 - comments.length} characters left.</p>
        </div>

        {submit.isError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
            <p>{submit.error instanceof Error ? submit.error.message : "Something went wrong. Please try again."}</p>
          </div>
        )}

        <Button
          onClick={() => submit.mutate()}
          disabled={rating === 0 || submit.isPending}
          className="w-full gap-1.5"
          size="lg"
        >
          <MessageSquareIcon className="size-4" />
          {submit.isPending ? "Sending…" : "Submit feedback"}
        </Button>
        {rating === 0 && <p className="-mt-3 text-center text-xs text-muted-foreground">Pick a rating to continue.</p>}
      </div>
    </Shell>
  )
}

// Standalone frame — this page is outside the dashboard layout on purpose.
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-sm sm:p-8">{children}</div>
    </main>
  )
}
