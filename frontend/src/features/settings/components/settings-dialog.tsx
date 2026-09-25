"use client"

import { SettingsIcon } from "lucide-react"

import { ACCOUNT_SECTION } from "./settings-sections"
import { AccountSecuritySettings } from "./account-security-settings"

/**
 * The Settings entry in the application sidebar — unchanged from before the
 * All Settings redesign, except that Calendly and Mail are no longer among
 * its options.
 *
 * Kept deliberately separate from All Settings, which is the full-screen
 * window behind the gear in the top bar. This page belongs to the PERSON: a
 * password and the devices they are signed in on. That window belongs to the
 * WORKSPACE: departments, integrations, how people are numbered. Somebody
 * changing their own password has no business walking through department
 * management to get there, and the two have nothing to say to each other.
 */
export function SettingsView() {
  const Icon = ACCOUNT_SECTION.icon

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

      {/* The same underline tab strip this page has always had. One tab now
          that Calendly and Mail have moved, and kept rather than dropped
          because the layout below it is unchanged and a heading floating with
          no strip above it reads as a page that lost something. */}
      <nav aria-label="Settings sections" className="flex flex-wrap gap-1.5 border-b pb-px">
        <span
          aria-current="page"
          className="flex items-center gap-1.5 rounded-t-lg border-b-2 border-role-admin px-3 py-2 text-sm font-semibold text-role-admin"
        >
          <Icon className="size-4" />
          {ACCOUNT_SECTION.label}
        </span>
      </nav>

      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-admin/12 text-role-admin">
            <Icon className="size-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {ACCOUNT_SECTION.label}
            </h2>
            <p className="text-sm text-muted-foreground">{ACCOUNT_SECTION.description}</p>
          </div>
        </div>

        <AccountSecuritySettings />
      </div>
    </div>
  )
}

export const SettingsDialog = SettingsView
