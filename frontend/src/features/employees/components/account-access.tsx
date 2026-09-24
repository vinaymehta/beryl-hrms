"use client"

import { useState } from "react"
import { MailIcon, SendIcon, KeyRoundIcon, CheckCircle2Icon, ClockIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { roleBadgeClasses } from "@/constants/permissions"
import {
  useInviteEmployee,
  useResetEmployeePassword,
} from "@/features/employees/hooks/use-employee-mutations"
import type { Employee } from "@/types/employees"

/** The three states an account can be in, as one label the admin can act on. */
function accountState(account: NonNullable<Employee["user"]>) {
  if (account.status === "disabled") {
    return { label: "Disabled", tone: "bg-muted text-muted-foreground", icon: ClockIcon }
  }
  if (account.invitationUnsent) {
    return { label: "Not invited", tone: "bg-muted text-muted-foreground", icon: ClockIcon }
  }
  if (account.invitationPending) {
    return { label: "Invitation sent", tone: "bg-warning/15 text-warning", icon: ClockIcon }
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
 * The employee's login account, and the two things an admin can do to it.
 *
 * Neither action takes or reveals a password, and that is the point of the
 * design rather than an incidental detail: the account is created with a
 * random secret nobody reads, and the only place a password is ever typed is
 * the form the employee opens from the link sent to their own mailbox. There
 * is deliberately no "set password for this employee" field anywhere in this
 * UI, because there is no endpoint behind it.
 *
 * Reset is behind a confirmation because it is outward-facing — it puts mail
 * in somebody's inbox — and because pressing it on the wrong row is easy.
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
  const [confirmingReset, setConfirmingReset] = useState(false)
  // Off by default. Requiring a change moments after the person chose their
  // own password from the invitation link is a real cost to them, so it is
  // something an admin opts into rather than something that happens quietly.
  const [forceChange, setForceChange] = useState(false)

  const account = employee.user

  if (!account) {
    return (
      <p className="text-sm text-muted-foreground">
        No login account. Add a work email from Edit, then invite them — they set their own
        password.
      </p>
    )
  }

  const state = accountState(account)
  const StateIcon = state.icon
  const invitedOn = formatDate(account.invitedAt)
  const acceptedOn = formatDate(account.invitationAcceptedAt)
  const busy = invite.isPending || resetPassword.isPending

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

      {/* The dates, so "invitation sent" isn't a state with no history behind
          it — an admin chasing a new joiner needs to know whether it went out
          this morning or three weeks ago. */}
      {(invitedOn || acceptedOn) && (
        <p className="text-xs text-muted-foreground">
          {acceptedOn
            ? `Account set up on ${acceptedOn}.`
            : `Invitation sent on ${invitedOn}. Waiting for them to choose a password.`}
        </p>
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
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {account.invitationAcceptedAt === null ? (
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy || account.status === "disabled"}
                onClick={() => invite.mutate({ id: employee.id, forcePasswordChange: forceChange })}
              >
                <SendIcon className="size-3.5" />
                {invite.isPending
                  ? "Sending…"
                  : account.invitationUnsent
                    ? "Send invitation"
                    : "Resend invitation"}
              </Button>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Checkbox
                  checked={forceChange}
                  onCheckedChange={(next) => setForceChange(next === true)}
                  disabled={busy}
                />
                Force password update after first login
              </label>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={busy}
              onClick={() => setConfirmingReset(true)}
            >
              <KeyRoundIcon className="size-3.5" />
              {resetPassword.isPending ? "Sending…" : "Send password reset"}
            </Button>
          )}
          <p className="w-full text-xs text-muted-foreground">
            You can&apos;t see or set someone else&apos;s password. Both actions email them a
            secure link; they choose it themselves.
          </p>
        </div>
      )}

      <Dialog open={confirmingReset} onOpenChange={setConfirmingReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a password reset?</DialogTitle>
            <DialogDescription>
              {account.email} will get a link to choose a new password. Their current password
              keeps working until they use it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              disabled={resetPassword.isPending}
              onClick={() => {
                resetPassword.mutate(employee.id, { onSuccess: () => setConfirmingReset(false) })
              }}
            >
              {resetPassword.isPending ? "Sending…" : "Send reset link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
