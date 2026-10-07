"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  MailIcon,
  SendIcon,
  CheckCircle2Icon,
  ClockIcon,
  CopyIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { PasswordInput } from "@/components/ui/password-input"
import { roleBadgeClasses } from "@/constants/permissions"
import { toast } from "sonner"

import { employeesApi } from "@/features/employees/api"
import {
  useInviteEmployee,
  useResetEmployeePassword,
} from "@/features/employees/hooks/use-employee-mutations"
import type { AccountActionResult, Employee } from "@/types/employees"

/** The three states an account can be in, as one label the admin can act on. */
function accountState(account: NonNullable<Employee["user"]>) {
  if (account.status === "disabled") {
    return { label: "Disabled", tone: "bg-muted text-muted-foreground", icon: ClockIcon }
  }
  if (account.credentialsUnsent) {
    return { label: "No password sent", tone: "bg-muted text-muted-foreground", icon: ClockIcon }
  }
  return { label: "Active", tone: "bg-success/15 text-success", icon: CheckCircle2Icon }
}

function formatDate(value: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * The employee's login account, and what an admin can do to it.
 *
 * The flow: an administrator sets the password in Edit and saves (that only
 * sets it — Employees::SetPassword), then sends it from here, choosing whether
 * it must be replaced at first sign-in. Send never changes the password; it
 * emails the CURRENT one. If the employee later picks their own, that is what
 * Current password shows (and what a resend would send).
 *
 * Current password is masked until revealed, and only administrators see this
 * section — it is behind `canManage`, which is
 * EmployeePolicy#manage_account_access?. The employee looking at their own
 * record never reaches it.
 *
 * What it costs, stated plainly because the previous design avoided it: this
 * password goes out in an email and is known to the administrator who sent
 * it. "Force password update" is the mitigation — it makes the emailed
 * password good for exactly one sign-in — which is why it is ticked by
 * default here.
 */
export function AccountAccess({
  employee,
  canManage,
}: {
  employee: Employee
  canManage: boolean
}) {
  const invite = useInviteEmployee()
  const resetPassword = useResetEmployeePassword()
  // Ticked by default, unlike the old invitation flow. There, the employee
  // chose their own password from a link and forcing an immediate change was
  // pure friction. Here the administrator knows it, so replacing it is the
  // point rather than an imposition.
  const [forceChange, setForceChange] = useState(true)
  const account = employee.user
  const queryClient = useQueryClient()
  const currentKey = ["employees", employee.id, "current-password"]
  const current = useQuery({
    queryKey: currentKey,
    queryFn: () => employeesApi.currentPassword(employee.id),
    enabled: canManage && !!account,
  })

  if (!account) {
    return (
      <p className="text-sm text-muted-foreground">
        No login account. Add a work email from Edit, then send them a password.
      </p>
    )
  }

  const state = accountState(account)
  const StateIcon = state.icon
  const sentOn = formatDate(account.credentialsSentAt)
  const busy = invite.isPending || resetPassword.isPending
  const hasPassword = !!current.data?.password

  // What went out is exactly the current password; refresh the copy shown.
  function onSent(result: AccountActionResult) {
    queryClient.setQueryData(currentKey, { password: result.password })
  }

  async function copyCurrent(value: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success("Password copied.")
    } catch {
      toast.error("Couldn't copy — select it and copy by hand.")
    }
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-0.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MailIcon className="size-3.5" /> Work email
          </p>
          <p className="text-sm font-medium break-all">{account.email}</p>
        </div>
        <div className="grid gap-0.5">
          <p className="text-xs text-muted-foreground">Account</p>
          <div>
            <Badge className={`gap-1 ${state.tone}`}>
              <StateIcon className="size-3" />
              {state.label}
            </Badge>
          </div>
        </div>
      </div>

      {/* Surfaced, because an admin who ticked the box a week ago has no other
          way to see that the requirement is still outstanding. */}
      {account.mustChangePassword && (
        <p className="rounded-lg border border-warning/40 bg-warning/5 px-2.5 py-2 text-xs text-warning">
          They&apos;ll be asked to choose a new password before they can use the app.
        </p>
      )}

      {sentOn && (
        <p className="text-xs text-muted-foreground">Password last emailed on {sentOn}.</p>
      )}

      <div className="grid gap-1.5">
        <p className="text-xs text-muted-foreground">Roles</p>
        <div className="flex flex-wrap gap-1.5">
          {employee.roles.map((role) => (
            <Badge key={role.id} className={roleBadgeClasses(role.slug)}>
              {role.name}
            </Badge>
          ))}
        </div>
      </div>

      {canManage && (
        <div className="grid gap-1.5 border-t pt-4">
          <p className="text-xs text-muted-foreground">Current password</p>
          {current.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : current.data?.password ? (
            <div className="flex items-start gap-2">
              {/* Hidden until the eye is pressed, like the New password field
                  below — read-only, since this is what they sign in with. */}
              <div className="min-w-0 max-w-72 flex-1">
                <PasswordInput
                  aria-label="Current password"
                  value={current.data.password}
                  readOnly
                  autoComplete="off"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Copy current password"
                onClick={() => copyCurrent(current.data!.password!)}
              >
                <CopyIcon className="size-3.5" />
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not recorded yet — it was set before passwords were kept. Send a new one below to record it.
            </p>
          )}
        </div>
      )}

      {canManage && (
        <div className="grid gap-3 border-t pt-4">
          <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={forceChange}
              onCheckedChange={(next) => setForceChange(next === true)}
              disabled={busy}
            />
            <span>
              Force password update after first login
              <span className="block text-[11px]">
                Recommended — this password arrives by email and you know it.
              </span>
            </span>
          </label>

          <div className="grid gap-1.5">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy || !hasPassword || account.status === "disabled"}
                onClick={() => {
                  const send = account.credentialsUnsent ? invite : resetPassword
                  send.mutate({ id: employee.id, forcePasswordChange: forceChange }, { onSuccess: onSent })
                }}
              >
                <SendIcon className="size-3.5" />
                {busy ? "Sending…" : account.credentialsUnsent ? "Send sign-in details" : "Resend sign-in details"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {hasPassword
                ? `Emails ${account.email} their current password. It doesn't change it — to change it, use Edit and save first.`
                : "No password set yet. Set one from Edit and save, then send it from here."}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
