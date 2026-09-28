"use client"

import { useState } from "react"
import { SettingsIcon } from "lucide-react"

import { cn } from "cn"
import { PERSONAL_SETTINGS_TABS, type PersonalSettingsTab } from "./settings-sections"
import { AccountSettings, SessionsSettings } from "./personal-settings"

const TAB_CONTENT: Record<PersonalSettingsTab, React.ComponentType> = {
  account: AccountSettings,
  sessions: SessionsSettings,
}

/**
 * The Settings entry in the application sidebar.
 *
 * Kept deliberately separate from All Settings, which is the workspace
 * administration behind the gear in the top bar. This page belongs to the
 * PERSON: a password, and the devices they are signed in on — one tab each.
 *
 * Switching tabs is not a route change; the URL is kept in step with
 * history.replaceState so a refresh or a shared link opens the same tab.
 */
export function SettingsView({ initialTab = "account" }: { initialTab?: PersonalSettingsTab }) {
  const [tab, setTab] = useState<PersonalSettingsTab>(initialTab)
  const active = PERSONAL_SETTINGS_TABS.find((t) => t.id === tab)!
  const Content = TAB_CONTENT[tab]
  const ActiveIcon = active.icon

  function openTab(next: PersonalSettingsTab) {
    setTab(next)
    window.history.replaceState(null, "", next === "account" ? "/settings" : `/settings?tab=${next}`)
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
            Manage your password and the devices you are signed in on.
          </p>
        </div>
      </div>

      <nav aria-label="Settings sections" role="tablist" className="flex flex-wrap gap-1.5 border-b pb-px">
        {PERSONAL_SETTINGS_TABS.map((t) => {
          const Icon = t.icon
          const selected = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => openTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-sm transition-colors",
                selected
                  ? "border-role-admin font-semibold text-role-admin"
                  : "border-transparent font-medium text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          )
        })}
      </nav>

      <div role="tabpanel" className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-admin/12 text-role-admin">
            <ActiveIcon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">{active.label}</h2>
            <p className="text-sm text-muted-foreground">{active.description}</p>
          </div>
        </div>

        <Content />
      </div>
    </div>
  )
}

export const SettingsDialog = SettingsView
