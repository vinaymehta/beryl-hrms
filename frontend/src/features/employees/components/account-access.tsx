"use client"

import { useState } from "react"
import {
  MailIcon,
  SendIcon,
  KeyRoundIcon,
  CheckCircle2Icon,
  ClockIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { PasswordInput } from "@/components/ui/password-input"
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
import { generatePassword } from "@/features/employees/generate-password"
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
 * There is a password field here, and it is visible to administrators only —
 * the whole panel is behind `canManage`, which is
 * EmployeePolicy#manage_account_access?. The employee looking at their own
 * record never reaches this branch.
 *
 * The password is prefilled with a generated one rather than left blank. That
 * is deliberate: a blank field invites somebody to type "Welcome123", and the
 * generated value is both stronger than what anyone would choose and already
 * correct, so the fast path and the safe path are the same path.
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
  const [confirmingReset, setConfirmingReset] = useState(false)
  // Ticked by default, unlike the old invitation flow. There, the employee
  // chose their own password from a link and forcing an immediate change was
  // pure friction. Here the administrator knows it, so replacing it is the
  // point rather than an imposition.
  const [forceChange, setForceChange] = useState(true)
  const [password, setPassword] = useState(() => generatePassword())

  const account = employee.user

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

  // The sent password is not shown back: it is in the employee's inbox, and
  // the success toast says where it went. A fresh one is readied for the next
  // press, so the same password is never sent twice.
  function onSent() {
    setPassword(generatePassword())
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
        <div className="grid gap-3 border-t pt-4">
          <div className="grid gap-1.5">
            <Label htmlFor="account-password">Password to send</Label>
            {/* No Generate button here. Generating one belongs on the Add and
                Edit forms, where the password is part of what is being
                written; this panel is for SENDING it. The field still arrives
                prefilled, so the common case is press-and-go. */}
            {/* The width goes on a WRAPPER, not on PasswordInput itself: its
                className lands on the inner <input>, while the reveal button
                is positioned against the outer relative div — narrowing only
                the input leaves the eye stranded out to its right. */}
            <div className="max-w-72">
              <PasswordInput
                id="account-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                disabled={busy}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Goes to {account.email} and replaces whatever password they have now.
            </p>
          </div>

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

          <div className="flex flex-wrap gap-2">
            {account.credentialsUnsent ? (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy || !password || account.status === "disabled"}
                onClick={() =>
                  invite.mutate(
                    { id: employee.id, password, forcePasswordChange: forceChange },
                    { onSuccess: onSent }
                  )
                }
              >
                <SendIcon className="size-3.5" />
                {invite.isPending ? "Sending…" : "Send sign-in details"}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy || !password}
                onClick={() => setConfirmingReset(true)}
              >
                <KeyRoundIcon className="size-3.5" />
                {resetPassword.isPending ? "Sending…" : "Send a new password"}
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={confirmingReset} onOpenChange={setConfirmingReset}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a new password?</DialogTitle>
            <DialogDescription>
              {account.email} will be emailed a new password, and their current one stops working
              straight away. Any session they have open will be signed out.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
            <Button
              disabled={resetPassword.isPending}
              onClick={() => {
                resetPassword.mutate(
                  { id: employee.id, password, forcePasswordChange: forceChange },
                  {
                    onSuccess: () => {
                      onSent()
                      setConfirmingReset(false)
                    },
                  }
                )
              }}
            >
              {resetPassword.isPending ? "Sending…" : "Send new password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
