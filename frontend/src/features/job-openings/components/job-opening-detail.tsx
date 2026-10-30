"use client"

import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeftIcon, ArrowRightIcon, ChevronRightIcon, CopyIcon, ExternalLinkIcon, PencilIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { JobAdminAccess } from "@/features/job-openings/components/job-admin-access"
import { OpeningContent, OpeningHeading } from "@/features/job-openings/components/opening-content"
import { OpeningMenu, copyPublicLink } from "@/features/job-openings/components/opening-menu"
import { StatusSwitch } from "@/features/job-openings/components/status-switch"
import { applicationsHref, careersPath, dateTime, publicApiUrl } from "@/features/job-openings/format"
import { useJobOpening, useJobOpeningActions, useJobOpenings } from "@/features/job-openings/hooks"
import type { JobOpening } from "@/types/job-openings"

/**
 * One opening, read-only: its page content as the careers website lays it out,
 * with status, identifiers and order alongside. Editing is a click away.
 */
export function JobOpeningDetail({ id }: { id: number }) {
  return (
    <JobAdminAccess>
      <DetailLoader id={id} />
    </JobAdminAccess>
  )
}

function DetailLoader({ id }: { id: number }) {
  const { data: opening, isLoading, isError } = useJobOpening(id)

  if (isLoading) return <DetailSkeleton />
  if (isError || !opening) {
    return (
      <div className="grid gap-4">
        <Breadcrumb current="Not found" />
        <div className="grid justify-items-center gap-2 rounded-xl border border-dashed bg-card/50 px-6 py-14 text-center">
          <p className="text-sm font-semibold text-foreground">This job opening couldn&apos;t be found</p>
          <p className="text-xs text-muted-foreground">It may have been deleted.</p>
          <Button variant="outline" size="sm" className="mt-2" nativeButton={false} render={<Link href="/job-administration" />}>
            Back to Job Administration
          </Button>
        </div>
      </div>
    )
  }
  return <Detail opening={opening} />
}

function Detail({ opening }: { opening: JobOpening }) {
  const router = useRouter()
  const { data: openings = [] } = useJobOpenings()
  const { setActive } = useJobOpeningActions()
  const position = openings.findIndex((item) => item.id === opening.id) + 1
  const apiUrl = publicApiUrl(opening.slug)

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Breadcrumb and actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            nativeButton={false}
            render={<Link href="/job-administration" />}
          >
            <ArrowLeftIcon className="size-4" /> Back
          </Button>
          <Breadcrumb current={opening.title} />
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="gap-1.5 bg-role-admin text-role-admin-foreground shadow-sm hover:bg-role-admin/90"
            nativeButton={false}
            render={<Link href={`/job-administration/${opening.id}/edit`} />}
          >
            <PencilIcon className="size-4" /> Edit
          </Button>
          <OpeningMenu
            opening={opening}
            showViewDetails={false}
            triggerVariant="outline"
            onDeleted={() => router.push("/job-administration")}
          />
        </div>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <article className="grid gap-8 rounded-xl border bg-card px-5 py-6 shadow-2xs sm:px-10 sm:py-9">
          <OpeningHeading opening={opening} />
          <hr className="border-border" />
          <OpeningContent content={opening} />
        </article>

        <aside className="grid gap-4 lg:sticky lg:top-0">
          <SideCard title="Status">
            <div
              className={cn(
                "grid gap-2 rounded-lg border p-3",
                opening.isActive ? "border-success/25 bg-success/6" : "bg-muted/40"
              )}
            >
              <StatusSwitch
                checked={opening.isActive}
                disabled={setActive.isPending}
                label="Show on the careers website"
                onChange={() => setActive.mutate({ opening, active: !opening.isActive })}
              />
              <p className="text-xs text-muted-foreground">
                {opening.isActive
                  ? "Live — listed on the careers website."
                  : "Paused — kept here, hidden from the website."}
              </p>
            </div>
          </SideCard>

          <SideCard title="Applications">
            <div className="grid gap-2">
              <p className="text-sm text-foreground">
                Applications: <span className="font-semibold tabular-nums">{opening.applicationsCount}</span>
              </p>
              {opening.applicationsCount > 0 ? (
                <Link
                  href={applicationsHref(opening.id)}
                  className="inline-flex w-fit items-center gap-1 text-xs font-medium text-role-admin hover:underline"
                >
                  View them in Recruitment · Resumes
                  <ArrowRightIcon className="size-3" />
                </Link>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Applications sent from the careers website appear in Recruitment → Resumes.
                </p>
              )}
            </div>
          </SideCard>

          <SideCard title="Details">
            <dl className="grid gap-3.5 text-sm">
              <Row label="Code">
                <span className="font-mono text-[13px] text-foreground">{opening.code}</span>
              </Row>
              <Row label="Slug">
                <span className="font-mono text-[13px] break-words text-foreground">{opening.slug}</span>
              </Row>
              <Row label="Page path" hint="On the careers website">
                <span className="font-mono text-[13px] break-words text-foreground">{careersPath(opening.slug)}</span>
              </Row>
              <Row label="Public API">
                <div className="flex min-w-0 items-center gap-1">
                  <a
                    href={apiUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex min-w-0 items-center gap-1 font-mono text-[12px] text-role-admin hover:underline"
                    title={apiUrl}
                  >
                    <span className="truncate">/api/v1/public/job_openings/{opening.slug}</span>
                    <ExternalLinkIcon className="size-3 shrink-0" />
                  </a>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="Copy public API link"
                    title="Copy link"
                    onClick={() => copyPublicLink(opening.slug)}
                  >
                    <CopyIcon />
                  </Button>
                </div>
                {!opening.isActive && (
                  <p className="text-[11px] text-muted-foreground">Answers “not found” while the opening is paused.</p>
                )}
              </Row>
              <Row label="Position">
                <span className="text-foreground">
                  {position > 0 ? (
                    <>
                      <span className="font-semibold tabular-nums">{position}</span>
                      <span className="text-muted-foreground"> of {openings.length}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
              </Row>
            </dl>
          </SideCard>

          <SideCard title="History">
            <dl className="grid gap-3.5 text-sm">
              <Row label="Created">
                <span className="text-foreground tabular-nums">{dateTime(opening.createdAt)}</span>
              </Row>
              <Row label="Last updated">
                <span className="text-foreground tabular-nums">{dateTime(opening.updatedAt)}</span>
              </Row>
            </dl>
          </SideCard>

        </aside>
      </div>
    </div>
  )
}

function Breadcrumb({ current }: { current: string }) {
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      <Link href="/job-administration" className="shrink-0 text-muted-foreground hover:text-foreground">
        Job Administration
      </Link>
      <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
      <span aria-current="page" className="truncate font-medium text-foreground">
        {current}
      </span>
    </nav>
  )
}

function SideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 rounded-xl border bg-card p-4 shadow-2xs">
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid min-w-0 gap-0.5">
      <dt className="text-xs text-muted-foreground">
        {label}
        {hint && <span className="text-muted-foreground/70"> · {hint}</span>}
      </dt>
      <dd className="grid min-w-0 gap-1">{children}</dd>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="grid gap-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-8 w-28" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Skeleton className="h-[32rem] rounded-xl" />
        <div className="grid content-start gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
