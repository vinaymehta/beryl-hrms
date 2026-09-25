"use client"

import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { HashIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { companySettingsApi } from "@/features/employees/api"
import { errorMessage } from "@/lib/errors"

export const COMPANY_SETTINGS_QUERY_KEY = ["company-settings"] as const

/**
 * The first employee ID this company issues.
 *
 * Type "BOO1" once and the add-employee form prefills BOO1, then BOO2, then
 * BOO3 — so HR sets the shape rather than typing a code per hire. The trailing
 * number is what increments; everything before it is kept verbatim, and the
 * zero-padding is taken from what was typed, so "ACM-001" yields "ACM-002" and
 * "BOO1" yields "BOO2" rather than "BOO0002".
 *
 * Deliberately a SUGGESTION. The field on the employee form stays editable,
 * nothing is reserved by opening it, and the database's uniqueness constraint
 * remains what actually decides. Reserving would hand codes out to forms that
 * get abandoned and leave permanent gaps in a sequence somebody reads as a
 * headcount.
 */
export function InitialIdSettings() {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<string | null>(null)

  const settings = useQuery({
    queryKey: COMPANY_SETTINGS_QUERY_KEY,
    queryFn: companySettingsApi.get,
  })

  const save = useMutation({
    mutationFn: (employeeCodeInitial: string) => companySettingsApi.update({ employeeCodeInitial }),
    onSuccess: (next) => {
      queryClient.setQueryData(COMPANY_SETTINGS_QUERY_KEY, next)
      // The add-employee form asks for its own suggestion separately, and it
      // has just changed.
      queryClient.invalidateQueries({ queryKey: ["employees", "next-code"] })
      setDraft(null)
      toast.success(
        next.employeeCodeInitial
          ? `New employees will be numbered from ${next.employeeCodeInitial}.`
          : "Employee IDs will no longer be prefilled."
      )
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't save that.")),
  })

  if (settings.isPending) {
    return (
      <div className="grid gap-3">
        <Skeleton className="h-9 w-full max-w-xs" />
        <Skeleton className="h-4 w-64" />
      </div>
    )
  }

  if (settings.isError) {
    return <p className="text-sm text-destructive">Couldn&apos;t load this setting.</p>
  }

  const stored = settings.data.employeeCodeInitial ?? ""
  const value = draft ?? stored
  const dirty = value.trim() !== stored

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HashIcon className="size-4 text-role-admin" />
          Initial employee ID
        </CardTitle>
        <CardDescription>
          The first ID issued to a new employee. Every one after it counts up from there, and the
          field on the employee form stays editable.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (dirty) save.mutate(value.trim())
          }}
        >
          <Input
            aria-label="Initial employee ID"
            placeholder="e.g. BOO1"
            className="max-w-xs"
            value={value}
            disabled={save.isPending}
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {draft !== null && (
            <Button type="button" size="sm" variant="ghost" onClick={() => setDraft(null)}>
              Cancel
            </Button>
          )}
        </form>

        {/* What the setting will actually do, computed server-side from the
            codes already in use — so a company that has typed its own codes
            up to BOO47 sees BOO48 here rather than a number that would
            collide the moment it was saved. */}
        {settings.data.nextEmployeeCode ? (
          <p className="text-xs text-muted-foreground">
            The next employee added will be prefilled with{" "}
            <span className="font-medium text-foreground">{settings.data.nextEmployeeCode}</span>.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {stored
              ? "No further IDs can be derived from that value — add a number to the end of it, like BOO1."
              : "Leave this empty to keep typing employee IDs by hand."}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
