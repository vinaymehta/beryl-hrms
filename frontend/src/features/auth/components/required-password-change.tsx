"use client"

import { ShieldAlertIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ChangePasswordForm } from "@/features/auth/components/change-password-form"
import { useLogout } from "@/features/auth/hooks/use-auth-mutations"

/**
 * Shown in place of the entire app when an administrator required this person
 * to choose a new password.
 *
 * It replaces the dashboard rather than redirecting to a route, because a
 * route can be navigated away from and a replaced shell cannot — there is no
 * sidebar, no topbar and nothing else rendered, so there is nowhere to go.
 * That is only the visible half of the rule: the API refuses every other
 * endpoint with `password_change_required` regardless of what the client does,
 * so this screen is a courtesy, not the enforcement.
 *
 * Signing out stays available. Being required to change a password should not
 * mean being trapped in the tab — particularly on a shared machine, where the
 * person sitting there may not be the account holder.
 */
export function RequiredPasswordChange() {
  const logout = useLogout()

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
              <ShieldAlertIcon className="size-5" />
            </span>
            <CardTitle className="text-xl">Choose a new password</CardTitle>
            <CardDescription>
              Your administrator has asked you to set a new password before you carry on. You
              won&apos;t be able to use the rest of the app until you do.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ChangePasswordForm />
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-center text-muted-foreground"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              {logout.isPending ? "Signing out…" : "Sign out instead"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
