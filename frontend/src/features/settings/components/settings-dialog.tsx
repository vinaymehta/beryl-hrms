"use client"

import { Suspense, useState } from "react"
import { SettingsIcon } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { cn } from "cn"
import { SETTINGS_SECTIONS, settingsSection, type SettingsSectionId } from "./settings-sections"
import { AccountSecuritySettings } from "./account-security-settings"
import { CalendlySettings } from "./calendly-settings"
import { MailSettings } from "./mail-settings"

const SECTION_CONTENT: Record<SettingsSectionId, React.ComponentType> = {
  account: AccountSecuritySettings,
  calendly: CalendlySettings,
  mail: MailSettings,
}

/**
 * Settings, rendered as a full page in the dashboard shell.
 *
 * Sections are switched as state inside this component rather than by navigating
 * between the /settings routes. Navigating would unmount and remount the
 * page on every click; the URL is kept in step with history.replaceState instead,
 * so a refresh or a shared link still lands on the right section and the OAuth
 * callback routes keep working untouched.
 */
export function SettingsView({ initialSection }: { initialSection: SettingsSectionId }) {
  const targetSection = settingsSection(initialSection)
  const isAllowedInitial = usePermission(targetSection?.permission ?? [])

  // If the initial section is not permitted for this user (e.g. an employee landing
  // on /settings/interviews or /settings/mail), fall back to account settings.
  const verifiedInitial = isAllowedInitial ? initialSection : "account"
  const [section, setSection] = useState<SettingsSectionId>(verifiedInitial)

  const active = settingsSection(section)
  const Content = SECTION_CONTENT[section]

  function selectSection(id: SettingsSectionId) {
    setSection(id)
    // Keeps the address bar honest without a route transition. Next's router
    // reads pushState/replaceState, so usePathname stays in sync too.
    window.history.replaceState(null, "", settingsSection(id).href)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-role-admin/12 text-role-admin">
          <SettingsIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your account, integrations and platform preferences.
          </p>
        </div>
      </div>

      <div className="flex min-h-[600px] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xs lg:flex-row">
        {/* Horizontal strip on narrow screens, a proper column beside the
            content once there's room for one. */}
        <nav
          aria-label="Settings sections"
          className="flex shrink-0 gap-1 overflow-x-auto border-b p-3 lg:w-64 lg:flex-col lg:overflow-x-visible lg:overflow-y-auto lg:border-b-0 lg:border-r"
        >
          {SETTINGS_SECTIONS.map((s) => (
            <SettingsNavItem
              key={s.id}
              section={s}
              active={s.id === section}
              onSelect={() => selectSection(s.id)}
            />
          ))}
          {/* A section the viewer has no business in renders nothing at all
              — see SettingsNavItem. */}
        </nav>

        <div className="min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-admin/12 text-role-admin">
                <active.icon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  {active.label}
                </h2>
                <p className="text-sm text-muted-foreground">{active.description}</p>
              </div>
            </div>

            {/* Required, not decorative: the Calendly and Mail sections
                read the OAuth ?connected/?error params with
                useSearchParams, and a static route that does so from a
                Client Component fails the production build without a
                Suspense boundary above the call. */}
            <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
              <Content />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  )
}

export const SettingsDialog = SettingsView

function SettingsNavItem({
  section,
  active,
  onSelect,
}: {
  section: (typeof SETTINGS_SECTIONS)[number]
  active: boolean
  onSelect: () => void
}) {
  const Icon = section.icon
  // usePermission returns true for an empty list, which is what an
  // unrestricted section (Account & Security) wants.
  const allowed = usePermission(section.permission ?? [])

  if (section.permission && !allowed) return null

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors lg:w-full",
        active
          ? "bg-role-admin/8 ring-1 ring-role-admin/20"
          : "ring-1 ring-transparent hover:bg-muted/60"
      )}
    >
      {/* The purple edge marking the current section — the same cue the main
          sidebar gives, at a size that suits a nested nav. */}
      {active && (
        <span aria-hidden className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-role-admin" />
      )}

      <span
        className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-role-admin/15 text-role-admin"
            : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Icon className="size-4.5" />
      </span>

      <span className="min-w-0">
        <span
          className={cn(
            "block truncate text-sm font-medium",
            active ? "text-role-admin" : "text-foreground"
          )}
        >
          {section.label}
        </span>
        <span className="hidden truncate text-xs text-muted-foreground sm:block">
          {section.caption}
        </span>
      </span>
    </button>
  )
}
