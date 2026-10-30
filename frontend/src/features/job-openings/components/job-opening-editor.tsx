"use client"

import { useEffect, useMemo, useState, type FormEvent, type MouseEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeftIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  EyeIcon,
  PencilLineIcon,
  RotateCcwIcon,
  SparklesIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { useDebounced } from "@/hooks/use-debounced"
import { JobAdminAccess } from "@/features/job-openings/components/job-admin-access"
import { ListEditor, toListItems, type ListItem } from "@/features/job-openings/components/list-editor"
import { OpeningContent, OpeningHeading } from "@/features/job-openings/components/opening-content"
import { StatusSwitch } from "@/features/job-openings/components/status-switch"
import { SuggestInput } from "@/features/job-openings/components/suggest-input"
import { careersPath, distinctValues } from "@/features/job-openings/format"
import {
  useJobOpening,
  useJobOpenings,
  useSaveJobOpening,
  useSuggestedIdentifiers,
} from "@/features/job-openings/hooks"
import {
  CODE_FORMAT,
  EMPLOYMENT_TYPES,
  LIMITS,
  LIST_ITEM_MAX,
  LIST_SIZE_MAX,
  REQUIRED,
  SLUG_FORMAT,
} from "@/features/job-openings/validation"
import { ApiError } from "@/types/api"
import type { JobOpening, JobOpeningInput } from "@/types/job-openings"

const LIST_FIELDS = ["responsibilities", "requirements", "niceToHave", "growthItems"] as const

interface FormState {
  title: string
  category: string
  employmentType: string
  location: string
  datePosted: string
  code: string
  slug: string
  summary: string
  intro: string
  about: string
  responsibilities: ListItem[]
  requirements: ListItem[]
  niceToHave: ListItem[]
  growthHeading: string
  growthItems: ListItem[]
  roleQuestion: string
  isActive: boolean
}

type Errors = Partial<Record<keyof FormState, string>>

function todayIso() {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

function initialState(opening: JobOpening | undefined): FormState {
  return {
    title: opening?.title ?? "",
    category: opening?.category ?? "",
    employmentType: opening?.employmentType ?? "Full-time",
    location: opening?.location ?? "",
    datePosted: opening?.datePosted ?? todayIso(),
    code: opening?.code ?? "",
    slug: opening?.slug ?? "",
    summary: opening?.summary ?? "",
    intro: opening?.intro ?? "",
    about: opening?.about ?? "",
    responsibilities: toListItems(opening?.responsibilities ?? []),
    requirements: toListItems(opening?.requirements ?? []),
    niceToHave: toListItems(opening?.niceToHave ?? []),
    growthHeading: opening?.growthHeading ?? "What you'll learn",
    growthItems: toListItems(opening?.growthItems ?? []),
    roleQuestion: opening?.roleQuestion ?? "",
    isActive: opening?.isActive ?? true,
  }
}

/** What would be sent — also what "unsaved changes" compares. */
function toInput(state: FormState): JobOpeningInput {
  const list = (items: ListItem[]) => items.map((item) => item.text.trim()).filter(Boolean)
  return {
    title: state.title.trim(),
    category: state.category.trim(),
    employmentType: state.employmentType.trim(),
    location: state.location.trim(),
    datePosted: state.datePosted,
    code: state.code.trim(),
    slug: state.slug.trim(),
    summary: state.summary.trim(),
    intro: state.intro.trim(),
    about: state.about.trim(),
    responsibilities: list(state.responsibilities),
    requirements: list(state.requirements),
    niceToHave: list(state.niceToHave),
    growthHeading: state.growthHeading.trim(),
    growthItems: list(state.growthItems),
    roleQuestion: state.roleQuestion.trim(),
    isActive: state.isActive,
  }
}

function validate(input: JobOpeningInput): Errors {
  const errors: Errors = {}
  for (const { field, label } of REQUIRED) {
    if (!input[field]) errors[field] = `${label} is required.`
  }
  for (const [field, max] of Object.entries(LIMITS) as [keyof typeof LIMITS, number][]) {
    if (!errors[field] && input[field].length > max) errors[field] = `At most ${max} characters.`
  }
  // Blank code/slug is fine: the server fills them in.
  if (input.code && !errors.code && !CODE_FORMAT.test(input.code)) {
    errors.code = "Letters, numbers and single hyphens only (e.g. BS-ENG-GET)."
  }
  if (input.slug && !errors.slug && !SLUG_FORMAT.test(input.slug)) {
    errors.slug = "Lowercase letters, numbers and single hyphens only."
  }
  for (const field of LIST_FIELDS) {
    const items = input[field]
    if (items.length > LIST_SIZE_MAX) errors[field] = `At most ${LIST_SIZE_MAX} items.`
    else if (items.some((item) => item.length > LIST_ITEM_MAX)) errors[field] = `Each item can be at most ${LIST_ITEM_MAX} characters.`
  }
  return errors
}

/** The page for creating (no `id`) or editing one opening. */
export function JobOpeningEditor({ id }: { id?: number }) {
  return (
    <JobAdminAccess>
      <EditorLoader id={id ?? null} />
    </JobAdminAccess>
  )
}

function EditorLoader({ id }: { id: number | null }) {
  const { data: opening, isLoading, isError } = useJobOpening(id)
  const { data: openings } = useJobOpenings()

  if (id !== null && isError) {
    return (
      <div className="grid justify-items-start gap-3">
        <Breadcrumb current="Not found" />
        <div className="w-full rounded-xl border border-dashed p-10 text-center">
          <p className="text-sm font-semibold text-foreground">This job opening couldn&apos;t be loaded</p>
          <p className="text-xs text-muted-foreground">It may have been deleted. Go back to the list and try again.</p>
        </div>
      </div>
    )
  }
  if (id !== null && (isLoading || !opening)) return <FormSkeleton />

  return <JobOpeningForm key={opening?.id ?? "new"} opening={opening} openings={openings ?? []} />
}

function JobOpeningForm({ opening, openings }: { opening?: JobOpening; openings: JobOpening[] }) {
  const router = useRouter()
  const editing = !!opening
  const [initial] = useState(() => initialState(opening))
  const [state, setState] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [submitted, setSubmitted] = useState(false)
  // Where to go once the admin confirms leaving with unsaved changes.
  const [confirmLeave, setConfirmLeave] = useState<string | null>(null)
  const [mode, setMode] = useState<"edit" | "preview">("edit")
  // A new opening's code and slug follow the title until the admin edits them.
  // An existing one's never change by themselves: the slug is its website URL.
  const [autoCode, setAutoCode] = useState(!editing)
  const [autoSlug, setAutoSlug] = useState(!editing)
  const save = useSaveJobOpening(opening?.id ?? null)

  // The server's suggestion for this title and category, and whether a code
  // or slug the admin typed is free. Only typed values are asked about: a
  // suggestion is free by construction.
  const lookup = useDebounced(
    {
      title: state.title.trim(),
      category: state.category.trim(),
      code: autoCode ? "" : state.code.trim(),
      slug: autoSlug ? "" : state.slug.trim(),
      exceptId: opening?.id,
    },
    350
  )
  const { data: suggested } = useSuggestedIdentifiers(lookup, !!lookup.title)

  // While automatic, the code and slug ARE the suggestion — nothing is copied
  // into state, so there is nothing to fall out of step.
  const shown = useMemo(
    () => ({
      ...state,
      code: autoCode ? (lookup.title ? (suggested?.code ?? "") : "") : state.code,
      slug: autoSlug ? (lookup.title ? (suggested?.slug ?? "") : "") : state.slug,
    }),
    [state, autoCode, autoSlug, suggested, lookup.title]
  )
  const input = useMemo(() => toInput(shown), [shown])
  const dirty = useMemo(() => JSON.stringify(input) !== JSON.stringify(toInput(initial)), [input, initial])
  const settled = lookup.code === (autoCode ? "" : input.code) && lookup.slug === (autoSlug ? "" : input.slug)

  useEffect(() => {
    if (!dirty || save.isPending) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty, save.isPending])

  const categories = useMemo(() => distinctValues(openings, "category"), [openings])
  const locations = useMemo(() => distinctValues(openings, "location"), [openings])
  const employmentTypes = useMemo(
    () => [...new Set([...EMPLOYMENT_TYPES, ...distinctValues(openings, "employmentType")])],
    [openings]
  )

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    const next = { ...shown, [field]: value }
    setState(next)
    // After a Save attempt the form re-checks as you type; before one, only a
    // (server) error on the field being edited goes away.
    if (submitted) setErrors(validate(toInput(next)))
    else if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }

  const codeTaken = settled && suggested?.codeAvailable === false && !!input.code
  const slugTaken = settled && suggested?.slugAvailable === false && !!input.slug
  const codeError = errors.code ?? (codeTaken ? "Already used by another opening." : undefined)
  const slugError = errors.slug ?? (slugTaken ? "Already used by another opening." : undefined)

  function focusFirstError(found: Errors) {
    const first = Object.keys(found)[0]
    if (!first) return
    setMode("edit")
    // After the edit view has rendered, if Save was pressed from Preview.
    requestAnimationFrame(() => {
      const element = document.getElementById(`job-${first}`)
      element?.scrollIntoView({ behavior: "smooth", block: "center" })
      element?.focus({ preventScroll: true })
    })
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitted(true)
    const found = validate(input)
    setErrors(found)
    if (Object.keys(found).length) {
      toast.error("Check the highlighted fields.")
      focusFirstError(found)
      return
    }

    // A suggestion for a title still being typed is stale; blank lets the
    // server work it out from what is actually saved.
    const stale = lookup.title !== input.title || lookup.category !== input.category
    const payload = {
      ...input,
      code: autoCode && stale ? "" : input.code,
      slug: autoSlug && stale ? "" : input.slug,
    }
    save.mutate(payload, {
      onSuccess: (saved) => {
        toast.success(editing ? `Saved “${saved.title}”.` : `Created “${saved.title}”.`, {
          description: saved.isActive ? "It's live on the careers website." : "It's paused — not on the website yet.",
        })
        router.push(`/job-administration/${saved.id}`)
      },
      onError: (error) => {
        if (error instanceof ApiError && error.errors.some((item) => item.field)) {
          const fromServer: Errors = {}
          for (const item of error.errors) {
            if (item.field && item.field in state && !fromServer[item.field as keyof FormState]) {
              fromServer[item.field as keyof FormState] = item.message
            }
          }
          setErrors(fromServer)
          toast.error("Check the highlighted fields.")
          focusFirstError(fromServer)
        } else {
          toast.error(error instanceof ApiError ? error.message : "Couldn't save the job opening.")
        }
      },
    })
  }

  // Cancel goes back where editing started: the opening's page, or the list.
  const leaveTo = editing ? `/job-administration/${opening.id}` : "/job-administration"

  function leave(to = leaveTo) {
    if (dirty) setConfirmLeave(to)
    else router.push(to)
  }


  const position = editing ? openings.findIndex((item) => item.id === opening.id) + 1 : 0

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-[minmax(0,1fr)] gap-5">
      {/* Header */}
      <div className="grid gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => leave("/job-administration")}>
            <ArrowLeftIcon className="size-4" /> Job Administration
          </Button>
          <Breadcrumb
            trail={editing ? [{ label: opening.title, href: `/job-administration/${opening.id}` }] : []}
            current={editing ? "Edit" : "New job opening"}
            onNavigate={(event) => {
              if (!dirty) return
              event.preventDefault()
              setConfirmLeave(event.currentTarget.getAttribute("href"))
            }}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight">
              {editing ? `Edit: ${opening.title}` : "New job opening"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {editing ? "Changes go live on the careers website when you save." : "Fill in the role as candidates will read it."}
            </p>
          </div>
          <div role="tablist" aria-label="Edit or preview" className="flex w-full gap-0.5 rounded-lg border bg-muted/50 p-0.5 sm:w-fit">
            {(
              [
                { id: "edit", label: "Edit", icon: PencilLineIcon },
                { id: "preview", label: "Preview", icon: EyeIcon },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={mode === tab.id}
                onClick={() => setMode(tab.id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs transition-colors sm:flex-none",
                  mode === tab.id
                    ? "bg-background font-medium text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <tab.icon className="size-3.5" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        {mode === "preview" ? (
          <article className="grid gap-8 rounded-xl border bg-card px-5 py-6 shadow-2xs sm:px-10 sm:py-9">
            <p className="-mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <EyeIcon className="size-3.5" /> Preview, unsaved changes included. The website applies its own design.
            </p>
            <OpeningHeading opening={input} />
            <hr className="border-border" />
            <OpeningContent content={input} />
          </article>
        ) : (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-5">
            <FormCard title="Basics" description="How the role is listed and grouped on the careers website.">
              <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
                <Field id="job-title" label="Job title" error={errors.title} count={[state.title.length, LIMITS.title]} className="md:col-span-2">
                  <Input
                    id="job-title"
                    value={state.title}
                    aria-invalid={!!errors.title || undefined}
                    placeholder="e.g. Graduate Engineer Trainee"
                    className="h-9"
                    onChange={(e) => set("title", e.target.value)}
                  />
                </Field>
                <Field id="job-category" label="Category" error={errors.category}>
                  <SuggestInput
                    id="job-category"
                    value={state.category}
                    options={categories}
                    invalid={!!errors.category}
                    placeholder="e.g. Engineering"
                    onChange={(value) => set("category", value)}
                  />
                </Field>
                <Field id="job-employmentType" label="Employment type" error={errors.employmentType}>
                  <SuggestInput
                    id="job-employmentType"
                    value={state.employmentType}
                    options={employmentTypes}
                    invalid={!!errors.employmentType}
                    placeholder="e.g. Full-time"
                    onChange={(value) => set("employmentType", value)}
                  />
                </Field>
                <Field id="job-location" label="Location" error={errors.location}>
                  <SuggestInput
                    id="job-location"
                    value={state.location}
                    options={locations}
                    invalid={!!errors.location}
                    placeholder="e.g. Faridabad"
                    onChange={(value) => set("location", value)}
                  />
                </Field>
                <Field id="job-datePosted" label="Date posted" error={errors.datePosted}>
                  <DatePicker
                    id="job-datePosted"
                    value={state.datePosted}
                    onChange={(next) => set("datePosted", next)}
                    aria-invalid={!!errors.datePosted || undefined}
                    className="h-9"
                  />
                </Field>
              </div>
            </FormCard>

            <FormCard title="Description" description="The summary for the list of openings, and the role's own page.">
              <div className="grid gap-5">
                <Field
                  id="job-summary"
                  label="Summary"
                  hint="One or two sentences, shown on the list of openings."
                  error={errors.summary}
                  count={[state.summary.length, LIMITS.summary]}
                >
                  <TextArea id="job-summary" minRows={2} value={state.summary} invalid={!!errors.summary} onChange={(v) => set("summary", v)} />
                </Field>
                <Field id="job-intro" label="Introduction" error={errors.intro} count={[state.intro.length, LIMITS.intro]}>
                  <TextArea id="job-intro" minRows={3} value={state.intro} invalid={!!errors.intro} onChange={(v) => set("intro", v)} />
                </Field>
                <Field id="job-about" label="About the role" error={errors.about} count={[state.about.length, LIMITS.about]}>
                  <TextArea id="job-about" minRows={4} value={state.about} invalid={!!errors.about} onChange={(v) => set("about", v)} />
                </Field>
              </div>
            </FormCard>

            <FormCard title="Role details" description="Each item becomes one bullet point. Drag or use the arrows to reorder.">
              <div className="grid gap-6">
                <ListEditor
                  id="job-responsibilities"
                  label="Responsibilities"
                  itemLabel="responsibility"
                  items={state.responsibilities}
                  onChange={(items) => set("responsibilities", items)}
                  placeholder="e.g. Build and improve features in web applications and APIs."
                  error={errors.responsibilities}
                />
                <ListEditor
                  id="job-requirements"
                  label="Requirements"
                  itemLabel="requirement"
                  items={state.requirements}
                  onChange={(items) => set("requirements", items)}
                  placeholder="e.g. Working knowledge of at least one programming language."
                  error={errors.requirements}
                />
                <ListEditor
                  id="job-niceToHave"
                  label="Nice to have"
                  itemLabel="nice-to-have"
                  items={state.niceToHave}
                  onChange={(items) => set("niceToHave", items)}
                  placeholder="e.g. A basic understanding of databases and SQL."
                  error={errors.niceToHave}
                />
              </div>
            </FormCard>

            <FormCard title="Growth" description="What someone learns in the role, under its own heading.">
              <div className="grid gap-5">
                <Field
                  id="job-growthHeading"
                  label="Section heading"
                  error={errors.growthHeading}
                  count={[state.growthHeading.length, LIMITS.growthHeading]}
                >
                  <Input
                    id="job-growthHeading"
                    value={state.growthHeading}
                    aria-invalid={!!errors.growthHeading || undefined}
                    className="h-9"
                    onChange={(e) => set("growthHeading", e.target.value)}
                  />
                </Field>
                <ListEditor
                  id="job-growthItems"
                  label="Items"
                  itemLabel="item"
                  items={state.growthItems}
                  onChange={(items) => set("growthItems", items)}
                  placeholder="e.g. How production software is designed, built and operated."
                  error={errors.growthItems}
                />
              </div>
            </FormCard>

            <FormCard title="Application question" description="Optional. Everyone applying for this role answers it.">
              <Field id="job-roleQuestion" label="Question" error={errors.roleQuestion} count={[state.roleQuestion.length, LIMITS.roleQuestion]}>
                <TextArea
                  id="job-roleQuestion"
                  minRows={2}
                  value={state.roleQuestion}
                  invalid={!!errors.roleQuestion}
                  placeholder="e.g. Tell us about something you've built that you're proud of."
                  onChange={(v) => set("roleQuestion", v)}
                />
              </Field>
            </FormCard>
          </div>
        )}

        {/* Sidebar: publishing, identifiers and order. */}
        <aside className="grid gap-5 xl:sticky xl:top-0">
          <FormCard title="Status">
            <div className="grid gap-2">
              <StatusSwitch
                id="job-isActive"
                checked={state.isActive}
                label="Show on the careers website"
                onChange={() => set("isActive", !state.isActive)}
              />
              <p className="text-xs text-muted-foreground">
                {state.isActive ? "Listed on the careers website once saved." : "Saved here, hidden from the website."}
              </p>
            </div>
          </FormCard>

          <FormCard title="URL & identifiers">
            <div className="grid gap-5">
              <Field
                id="job-code"
                label="Code"
                error={codeError}
                action={
                  autoCode ? (
                    <AutoTag />
                  ) : suggested && suggested.code !== input.code ? (
                    <ResetButton onClick={() => setAutoCode(true)} />
                  ) : null
                }
              >
                <Input
                  id="job-code"
                  value={shown.code}
                  aria-invalid={!!codeError || undefined}
                  className="h-9 font-mono uppercase"
                  placeholder="From the title"
                  onChange={(e) => {
                    setAutoCode(false)
                    set("code", e.target.value.toUpperCase().replace(/\s+/g, "-"))
                  }}
                />
              </Field>
              <Field
                id="job-slug"
                label="Slug"
                error={slugError}
                hint={
                  editing && input.slug !== opening.slug
                    ? "Changing it changes the page's address; old links stop working."
                    : undefined
                }
                action={
                  autoSlug ? (
                    <AutoTag />
                  ) : suggested && suggested.slug !== input.slug ? (
                    <ResetButton onClick={() => setAutoSlug(true)} />
                  ) : null
                }
              >
                <Input
                  id="job-slug"
                  value={shown.slug}
                  aria-invalid={!!slugError || undefined}
                  className="h-9 font-mono"
                  placeholder="from-the-title"
                  onChange={(e) => {
                    setAutoSlug(false)
                    set("slug", e.target.value.toLowerCase().replace(/\s+/g, "-"))
                  }}
                />
              </Field>
              <div className="grid gap-1 rounded-lg bg-muted/50 px-3 py-2.5">
                <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Page path</p>
                <p className="font-mono text-xs break-all text-foreground">{careersPath(input.slug)}</p>
              </div>
            </div>
          </FormCard>

          <FormCard title="Order">
            <p className="text-sm text-foreground">
              {editing && position > 0 ? (
                <>
                  Position <span className="font-semibold tabular-nums">{position}</span>
                  <span className="text-muted-foreground"> of {openings.length}</span>
                </>
              ) : (
                "Added at the end of the list."
              )}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Reorder from the Job Administration list.</p>
          </FormCard>
        </aside>
      </div>

      {/* Actions — pinned to the bottom of the scrolling page; the form ends
          with it, so it never hides the last field. */}
      <div className="sticky bottom-0 z-20 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t bg-background px-4 py-3 shadow-[0_-4px_12px_-6px_rgb(0_0_0/0.12)] md:-mx-6 md:-mb-6 md:px-6">
        <p className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted-foreground">
          {dirty ? (
            <>
              <span className="size-1.5 shrink-0 rounded-full bg-warning" /> Unsaved changes
            </>
          ) : editing ? (
            "No changes"
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant="outline" size="lg" disabled={save.isPending} onClick={() => leave()}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            disabled={save.isPending || (editing && !dirty)}
            className="bg-role-admin px-4 text-role-admin-foreground hover:bg-role-admin/90"
          >
            {save.isPending ? "Saving…" : editing ? "Save changes" : "Create opening"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmLeave !== null} onOpenChange={(open) => !open && setConfirmLeave(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard your changes?</DialogTitle>
            <DialogDescription>
              {editing ? "Your edits to this opening haven't been saved." : "This opening hasn't been created yet."} Leaving
              now loses them.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Keep editing</Button>} />
            <Button variant="destructive" onClick={() => router.push(confirmLeave ?? leaveTo)}>
              Discard changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}

function Breadcrumb({
  trail = [],
  current,
  onNavigate,
}: {
  trail?: { label: string; href: string }[]
  current: string
  onNavigate?: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const links = [{ label: "Job Administration", href: "/job-administration" }, ...trail]
  return (
    <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
      {links.map((link) => (
        <span key={link.href} className="flex min-w-0 items-center gap-1">
          <Link href={link.href} onClick={onNavigate} className="truncate text-muted-foreground hover:text-foreground">
            {link.label}
          </Link>
          <ChevronRightIcon className="size-3.5 shrink-0 text-muted-foreground/60" />
        </span>
      ))}
      <span aria-current="page" className="shrink-0 font-medium text-foreground">
        {current}
      </span>
    </nav>
  )
}

/** A form section: a header row (title, one line on what it's for) over its fields. */
function FormCard({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
      <header className="grid gap-0.5 border-b px-5 py-3.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  count,
  action,
  className,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  /** [current length, maximum] — a quiet character count, louder near the limit. */
  count?: [number, number]
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const ratio = count ? count[0] / count[1] : 0
  return (
    <div className={cn("grid min-w-0 content-start gap-1.5", className)}>
      <div className="flex min-h-5 items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {action}
          {count && (
            <span
              className={cn(
                "text-xs tabular-nums",
                ratio > 1 ? "font-medium text-destructive" : ratio >= 0.9 ? "text-warning" : "text-muted-foreground/60"
              )}
            >
              {count[0]}/{count[1]}
            </span>
          )}
        </div>
      </div>
      {children}
      {error ? (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <CircleAlertIcon className="size-3.5 shrink-0" />
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-muted-foreground">{hint}</p>
      )}
    </div>
  )
}

/** Grows with its text (field-sizing), from `minRows` up. */
function TextArea({
  id,
  minRows,
  value,
  invalid,
  placeholder,
  onChange,
}: {
  id: string
  minRows: number
  value: string
  invalid: boolean
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <textarea
      id={id}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      aria-invalid={invalid || undefined}
      onChange={(event) => onChange(event.target.value)}
      style={{ minHeight: `${minRows * 1.5 + 1.25}rem` }}
      className="field-sizing-content max-h-[32rem] w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-2 text-base leading-6 outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30"
    />
  )
}

function AutoTag() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-role-admin/10 px-1.5 py-0.5 text-[11px] font-medium text-role-admin"
      title="Made from the title and category until you edit it"
    >
      <SparklesIcon className="size-3" /> Auto
    </span>
  )
}

function ResetButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-medium text-role-admin hover:underline"
    >
      <RotateCcwIcon className="size-3" /> Use auto
    </button>
  )
}

function FormSkeleton() {
  return (
    <div className="grid gap-5">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-7 w-72" />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="grid gap-5">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
        <div className="grid content-start gap-5">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
