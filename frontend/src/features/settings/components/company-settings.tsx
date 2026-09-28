"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Building2Icon } from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { companySettingsApi } from "@/features/employees/api"
import { CURRENT_USER_QUERY_KEY } from "@/features/auth/hooks/use-current-user"
import { COMPANY_SETTINGS_QUERY_KEY } from "./initial-id-settings"
import { errorMessage } from "@/lib/errors"
import type { CompanySettings as CompanySettingsData } from "@/types/employees"

/**
 * The company's name, and its work-email rule.
 *
 * With the check ON, a login can only be created for an address ending in
 * @<domain>. Switching it OFF accepts any valid address — the domain is kept,
 * so switching it back on restores the same rule rather than starting over.
 * The server applies the same switch (Company#enforced_work_email_domain).
 */
export function CompanySettings() {
  const settings = useQuery({ queryKey: COMPANY_SETTINGS_QUERY_KEY, queryFn: companySettingsApi.get })

  if (settings.isPending) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-9 w-full max-w-sm" />
        <Skeleton className="h-9 w-full max-w-sm" />
      </div>
    )
  }
  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load these settings.</p>
  }

  // Keyed on what was loaded, so a save re-seeds the form from the server.
  const d = settings.data
  return <CompanyForm key={`${d.companyName}|${d.workEmailDomainSetting}|${d.workEmailDomainEnforced}`} data={d} />
}

function CompanyForm({ data }: { data: CompanySettingsData }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(data.companyName)
  const [domain, setDomain] = useState(data.workEmailDomainSetting ?? "")
  const [enforced, setEnforced] = useState(data.workEmailDomainEnforced)

  const cleanDomain = domain.trim().toLowerCase().replace(/^@/, "")
  const dirty =
    name.trim() !== data.companyName ||
    cleanDomain !== (data.workEmailDomainSetting ?? "") ||
    enforced !== data.workEmailDomainEnforced
  const nameOk = name.trim().length > 0
  // A check with nothing to check against would silently accept everything.
  const domainOk = !enforced || cleanDomain.length > 0

  const save = useMutation({
    mutationFn: () =>
      companySettingsApi.update({
        name: name.trim(),
        workEmailDomain: cleanDomain,
        workEmailDomainEnforced: enforced,
      }),
    onSuccess: (next) => {
      queryClient.setQueryData(COMPANY_SETTINGS_QUERY_KEY, next)
      // The company name is shown in the shell; the employee form reads the rule.
      queryClient.invalidateQueries({ queryKey: CURRENT_USER_QUERY_KEY })
      toast.success(
        next.workEmailDomain
          ? `Saved. Work emails must end with @${next.workEmailDomain}.`
          : "Saved. Any valid email address is accepted as a work email."
      )
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't save the company settings.")),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Building2Icon className="size-4 text-role-admin" />
          Company
        </CardTitle>
        <CardDescription>Your company&apos;s name, and which addresses may be used as work emails.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid max-w-md gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (dirty && nameOk && domainOk) save.mutate()
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="company-name">Company name</Label>
            <Input
              id="company-name"
              value={name}
              disabled={save.isPending}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={!nameOk}
            />
            {!nameOk && <p className="text-xs text-destructive">Company name is required</p>}
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="company-domain">Work email domain</Label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">@</span>
              <Input
                id="company-domain"
                placeholder="berylsystems.com"
                value={domain}
                disabled={save.isPending}
                onChange={(event) => setDomain(event.target.value)}
                aria-invalid={!domainOk}
              />
            </div>
            {!domainOk && (
              <p className="text-xs text-destructive">Enter a domain, or switch the check off</p>
            )}
          </div>

          <div className="flex items-start justify-between gap-4 rounded-lg border p-3">
            <div className="grid gap-0.5">
              <p id="company-domain-check" className="text-sm font-medium">
                Check work email domain
              </p>
              <p className="text-xs text-muted-foreground">
                {enforced
                  ? `Only addresses ending in @${cleanDomain || "your domain"} can be given a login.`
                  : "Off — any valid email address is accepted as a work email."}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enforced}
              aria-labelledby="company-domain-check"
              disabled={save.isPending}
              onClick={() => setEnforced((value) => !value)}
              className={cn(
                "relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50",
                enforced ? "bg-role-admin" : "bg-muted-foreground/30"
              )}
            >
              <span
                className={cn(
                  "inline-block size-4 rounded-full bg-background shadow transition-transform",
                  enforced ? "translate-x-4.5" : "translate-x-0.5"
                )}
              />
            </button>
          </div>

          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={!dirty || !nameOk || !domainOk || save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            {dirty && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={save.isPending}
                onClick={() => {
                  setName(data.companyName)
                  setDomain(data.workEmailDomainSetting ?? "")
                  setEnforced(data.workEmailDomainEnforced)
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
