import { CheckCircle2Icon, MonitorIcon, ShieldCheckIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChangePasswordForm } from "@/features/auth/components/change-password-form"
import { SessionsList } from "@/features/auth/components/sessions-list"

// Exactly what changePasswordSchema enforces, and nothing more. The rules a
// settings page advertises have to be the rules the app actually applies —
// listing complexity requirements nobody checks would just be a lie that
// users discover by being let through anyway.
const PASSWORD_RULES = ["At least 8 characters", "Both new password fields must match"]

export function AccountSecuritySettings() {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Change password</CardTitle>
          <CardDescription>Use a strong password to keep your account secure.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Form and requirements side by side, stacked on narrow screens —
              the rules stay readable while the fields are filled in rather
              than sitting off the bottom of the card. The panel is sized for
              the dialog's own content column (~688px at lg), not the
              viewport, since the dialog caps at max-w-5xl either way. */}
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_14rem] lg:items-start">
            <ChangePasswordForm />

            <div className="rounded-xl bg-role-admin/5 p-4 ring-1 ring-role-admin/15">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheckIcon className="size-4 text-role-admin" />
                Password requirements
              </p>
              <ul className="mt-3 space-y-2">
                {PASSWORD_RULES.map((rule) => (
                  <li key={rule} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <CheckCircle2Icon className="mt-px size-3.5 shrink-0 text-role-admin/70" />
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-role-admin/12 text-role-admin">
              <MonitorIcon className="size-4" />
            </span>
            Active sessions
          </CardTitle>
          <CardDescription>
            Everywhere you&apos;re currently signed in. Revoke any device you don&apos;t recognize.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SessionsList />
        </CardContent>
      </Card>
    </>
  )
}
