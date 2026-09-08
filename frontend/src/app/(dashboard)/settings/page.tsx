import Link from "next/link"
import { SettingsIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChangePasswordForm } from "@/features/auth/components/change-password-form"

export const metadata = { title: "Settings" }

export default function SettingsPage() {
  return (
    <div className="grid max-w-2xl gap-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-role-admin/12 text-role-admin">
          <SettingsIcon className="size-4.5" />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Change the password you use to sign in.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>See and revoke devices signed in to your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/settings/sessions" />}>
            Manage sessions
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mail</CardTitle>
          <CardDescription>Connect a Zoho mailbox to read and search mail in the app.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" nativeButton={false} render={<Link href="/settings/mail" />}>
            Manage mail connections
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
