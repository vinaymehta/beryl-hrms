import type { ReactNode } from "react"
import { BriefcaseIcon, CalendarDaysIcon, LayersIcon, MapPinIcon } from "lucide-react"
import { cn } from "cn"

import { postedDate } from "@/features/job-openings/format"
import type { JobOpeningInput } from "@/types/job-openings"

type Content = Pick<
  JobOpeningInput,
  | "intro"
  | "about"
  | "responsibilities"
  | "requirements"
  | "niceToHave"
  | "growthHeading"
  | "growthItems"
  | "roleQuestion"
>

/**
 * An opening's body as the careers page presents it — intro, about, the four
 * lists and the application question — in the app's own styling. Shared by
 * the detail page, the preview panel and the form's Preview tab.
 */
export function OpeningContent({ content, className }: { content: Content; className?: string }) {
  const lists = [
    { title: "Responsibilities", items: content.responsibilities },
    { title: "Requirements", items: content.requirements },
    { title: "Nice to have", items: content.niceToHave },
    { title: content.growthHeading || "What you'll learn", items: content.growthItems },
  ].filter((list) => list.items.length)

  return (
    <div className={cn("grid gap-8", className)}>
      {content.intro && <p className="text-[15px] leading-7 text-foreground">{content.intro}</p>}
      {content.about && (
        <ContentSection title="About the role">
          <p className="text-sm leading-7 whitespace-pre-line text-foreground/90">{content.about}</p>
        </ContentSection>
      )}
      {lists.map((list) => (
        <ContentSection key={list.title} title={list.title}>
          <ul className="grid gap-2.5">
            {list.items.map((item, index) => (
              <li key={index} className="flex gap-3 text-sm leading-6 text-foreground/90">
                <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-role-admin" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </ContentSection>
      ))}
      {content.roleQuestion && (
        <ContentSection title="Application question">
          <blockquote className="rounded-lg border-l-3 border-role-admin bg-role-admin/5 px-4 py-3 text-sm leading-6 text-foreground">
            {content.roleQuestion}
          </blockquote>
        </ContentSection>
      )}
    </div>
  )
}

function ContentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-base font-semibold tracking-tight text-foreground">{title}</h2>
      {children}
    </section>
  )
}

/** Category, location, type and date as quiet badges, then the title and the summary as its lead. */
export function OpeningHeading({
  opening,
}: {
  opening: Pick<JobOpeningInput, "title" | "summary" | "category" | "location" | "employmentType" | "datePosted">
}) {
  const meta = [
    { icon: LayersIcon, text: opening.category },
    { icon: MapPinIcon, text: opening.location },
    { icon: BriefcaseIcon, text: opening.employmentType },
    { icon: CalendarDaysIcon, text: opening.datePosted ? `Posted ${postedDate(opening.datePosted)}` : "" },
  ].filter((item) => item.text)

  return (
    <header className="grid gap-4">
      <div className="flex flex-wrap gap-1.5">
        {meta.map(({ icon: Icon, text }) => (
          <span
            key={text}
            className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2 py-1 text-xs font-medium text-muted-foreground"
          >
            <Icon className="size-3.5" />
            {text}
          </span>
        ))}
      </div>
      <h1 className="text-2xl font-semibold tracking-tight text-balance text-foreground sm:text-3xl">
        {opening.title || "Untitled opening"}
      </h1>
      {opening.summary && <p className="text-base leading-7 text-pretty text-muted-foreground">{opening.summary}</p>}
    </header>
  )
}
