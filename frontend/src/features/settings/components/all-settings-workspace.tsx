"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, SearchIcon, SettingsIcon, XIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { cn } from "cn"
import {
  SETTINGS_GROUPS,
  groupForSection,
  sectionsInGroup,
  settingsSection,
  type SettingsGroupId,
  type SettingsSection,
  type SettingsSectionId,
} from "./settings-sections"
import { CalendlySettings } from "./calendly-settings"
import { MailSettings } from "./mail-settings"
import { InitialIdSettings } from "./initial-id-settings"
import {
  AddDepartmentButton,
  DepartmentDesignationManager,
} from "@/features/employees/components/department-designation-manager"

// Account & Security is deliberately absent: it belongs to the person, not to
// the workspace, and lives on the sidebar's own Settings page. See SettingsView.
//
// The three department entries are the same component with its mode bound, so
// each is an ordinary page like any other and nothing here needs to know that
// three of them share an implementation.
const SECTION_CONTENT: Record<SettingsSectionId, React.ComponentType> = {
  departments_view: () => <DepartmentDesignationManager mode="view" />,
  departments_edit: () => <DepartmentDesignationManager mode="edit" />,
  departments_delete: () => <DepartmentDesignationManager mode="delete" />,
  calendly: CalendlySettings,
  mail: MailSettings,
  initial_id: InitialIdSettings,
}

/**
 * The primary action for a page, rendered beside its title.
 *
 * Top-right of the content area is where this belongs and where people look
 * for it — the reference design puts "New Role" exactly there. A page without
 * one simply has no entry here.
 */
const SECTION_ACTION: Partial<Record<SettingsSectionId, React.ComponentType>> = {
  departments_view: AddDepartmentButton,
  departments_edit: AddDepartmentButton,
  departments_delete: AddDepartmentButton,
}

/**
 * All Settings — a full-screen window over the app, reached from the gear in
 * the top bar.
 *
 * It takes the whole viewport rather than sitting inside the dashboard shell,
 * because administering the workspace is a different mode from using it: the
 * sidebar you navigate the product with is noise while you are configuring it,
 * and the way out is one deliberate "Close Settings" rather than a stray click.
 *
 * Rendered inside the dashboard route on purpose, though, so it inherits the
 * authentication gate and the forced-password-change gate rather than
 * re-implementing either.
 *
 * Two states, one window:
 *   landing   grouped cards, no left navigation.
 *   section   left navigation beside the chosen page, with a back chevron.
 *
 * Neither is a route change. Navigating would unmount and remount on every
 * click; the URL is kept honest with history.replaceState instead, so a
 * refresh or a shared link still lands in the right place.
 */
export function AllSettingsWorkspace({ initialSection }: { initialSection?: SettingsSectionId }) {
  const router = useRouter()
  const { user } = useCurrentUser()

  const target = initialSection ? settingsSection(initialSection) : null
  // `|| !target?.permission` is load-bearing: usePermission is `keys.some(...)`
  // over the list, which is FALSE for an empty one. A section requiring no
  // permission at all would otherwise read as forbidden to everybody.
  const allowedInitial = usePermission(target?.permission ?? []) || !target?.permission
  const verified = target && allowedInitial ? initialSection! : null

  const [section, setSection] = useState<SettingsSectionId | null>(verified ?? null)
  const [query, setQuery] = useState("")

  function openSection(id: SettingsSectionId) {
    setSection(id)
    setQuery("")
    window.history.replaceState(null, "", `/all-settings?section=${id}`)
  }

  function backToLanding() {
    setSection(null)
    window.history.replaceState(null, "", "/all-settings")
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-background">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b bg-surface px-4">
        {section && (
          <Button
            size="icon-sm"
            variant="outline"
            onClick={backToLanding}
            aria-label="Back to all settings"
            className="shrink-0 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
        )}
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-role-admin/12 text-role-admin">
          <SettingsIcon className="size-4.5" />
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight text-foreground">All Settings</h1>
          <p className="truncate text-xs text-muted-foreground">{user?.companyName}</p>
        </div>

        <div className="relative mx-auto hidden w-full max-w-lg md:block">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search settings"
            aria-label="Search settings"
            className="h-10 rounded-lg pl-9"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="ml-auto gap-2 font-medium md:ml-0"
          onClick={() => router.push("/")}
        >
          Close Settings
          <XIcon className="size-4 text-destructive" />
        </Button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === null ? (
          <Landing query={query} onOpen={openSection} />
        ) : (
          <SectionLayout section={section} onSelect={openSection} />
        )}
      </div>
    </div>
  )
}

/**
 * One titled card holding a column per group.
 *
 * Each column is a bordered panel with a tinted header naming the group, then
 * its pages as plain text. No chevrons, no hover cards: this is a directory
 * you scan, and decorating twenty links makes it harder to read, not easier.
 */
function Landing({
  query,
  onOpen,
}: {
  query: string
  onOpen: (id: SettingsSectionId) => void
}) {
  return (
    <div className="mx-auto w-full max-w-[1400px] p-4 md:p-8">
      <div className="rounded-2xl border bg-card p-5 md:p-8">
        <h2 className="text-xl font-medium tracking-tight text-foreground">Workspace Settings</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SETTINGS_GROUPS.map((group) => (
            <GroupCard key={group.id} group={group} query={query} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </div>
  )
}

function GroupCard({
  group,
  query,
  onOpen,
}: {
  group: (typeof SETTINGS_GROUPS)[number]
  query: string
  onOpen: (id: SettingsSectionId) => void
}) {
  const sections = useVisibleSections(group.id)
  const Icon = group.icon
  const matches = useMemo(() => filterSections(sections, query), [sections, query])

  // Nothing this viewer may see, or nothing matching what they typed.
  if (matches.length === 0) return null

  return (
    <section className="overflow-hidden rounded-xl border">
      <h3
        className={cn(
          "flex items-center gap-2 px-4 py-3 text-[15px] font-semibold text-foreground",
          group.tint.header
        )}
      >
        <span className={cn("flex size-6 items-center justify-center rounded-md", group.tint.icon)}>
          <Icon className="size-3.5" />
        </span>
        {group.label}
      </h3>
      <ul className="grid px-2 py-2">
        {matches.map((s) => (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s.id)}
              className="w-full rounded-lg px-2 py-2.5 text-left text-[15px] text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Left navigation beside the chosen page, groups collapsible. */
function SectionLayout({
  section,
  onSelect,
}: {
  section: SettingsSectionId
  onSelect: (id: SettingsSectionId) => void
}) {
  const active = settingsSection(section)
  const Content = SECTION_CONTENT[section]
  const Action = SECTION_ACTION[section]

  return (
    <div className="flex min-h-full flex-col lg:flex-row">
      <nav
        aria-label="Settings pages"
        className="shrink-0 border-b bg-surface/40 p-3 lg:w-[265px] lg:border-r lg:border-b-0"
      >
        <p className="px-2 pt-1 pb-2 text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          Workspace Settings
        </p>
        {SETTINGS_GROUPS.map((group) => (
          <NavGroup
            key={group.id}
            group={group}
            activeSection={section}
            onSelect={onSelect}
          />
        ))}
      </nav>

      <div className="min-w-0 flex-1 bg-background p-4 md:p-6">
        <div className="mx-auto grid w-full max-w-5xl gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight text-foreground">{active.label}</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">{active.description}</p>
            </div>
            {Action && (
              <div className="shrink-0">
                <Action />
              </div>
            )}
          </div>

          {/* Required, not decorative: the Calendly and Mail sections read the
              OAuth ?connected/?error params with useSearchParams, and a static
              route doing so from a Client Component fails the production build
              without a Suspense boundary above the call. */}
          <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
            <Content />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

function NavGroup({
  group,
  activeSection,
  onSelect,
}: {
  group: (typeof SETTINGS_GROUPS)[number]
  activeSection: SettingsSectionId
  onSelect: (id: SettingsSectionId) => void
}) {
  const sections = useVisibleSections(group.id)
  const holdsActive = sections.some((s) => s.id === activeSection)
  // Open the group you are in; the others start closed, which is what keeps a
  // long list readable rather than a flat wall of every page at once.
  const [open, setOpen] = useState(holdsActive)

  if (sections.length === 0) return null

  return (
    <div className="grid">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg px-2 py-2 text-left text-[15px] text-foreground transition-colors hover:bg-muted"
      >
        {open ? (
          <ChevronDownIcon className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronRightIcon className="size-3.5 text-muted-foreground" />
        )}
        {group.label}
      </button>

      {open && (
        <ul className="grid gap-0.5 pb-1">
          {sections.map((s) => {
            const isActive = s.id === activeSection
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "w-full rounded-lg py-2 pr-2 pl-8 text-left text-[15px] transition-colors",
                    isActive
                      ? "bg-role-admin font-medium text-role-admin-foreground"
                      : "text-foreground/75 hover:bg-muted hover:text-foreground"
                  )}
                >
                  {s.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function filterSections(sections: SettingsSection[], query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return sections

  // Matches the description too, so somebody searching "password" finds
  // Account & Security without knowing what it is called here.
  return sections.filter(
    (s) =>
      s.label.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle)
  )
}

/**
 * The sections of a group this viewer may actually see.
 *
 * A hook rather than a filter because each section's permission has to go
 * through usePermission, and hooks cannot be called in a loop whose length
 * varies — so the list is fixed and the results are read positionally.
 */
function useVisibleSections(group: SettingsGroupId): SettingsSection[] {
  const all = sectionsInGroup(group)
  const allowed = [
    usePermission(all[0]?.permission ?? []),
    usePermission(all[1]?.permission ?? []),
    usePermission(all[2]?.permission ?? []),
    usePermission(all[3]?.permission ?? []),
  ]
  return all.filter((s, index) => !s.permission || allowed[index])
}

export { groupForSection }
