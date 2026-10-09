"use client"

import { useRef, useState } from "react"
import { CheckCircle2Icon, ImageUpIcon, MonitorIcon, ShieldCheckIcon, Trash2Icon, TriangleAlertIcon } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { MAX_PHOTO_BYTES, PHOTO_TYPES } from "@/features/employees/components/edit-profile-sheet"
import { useUpdateOwnProfile } from "@/features/employees/hooks/use-employee-mutations"
import { useEmployee } from "@/features/employees/hooks/use-employees"
import { API_ORIGIN } from "@/lib/api-client"
import { ChangePasswordForm } from "@/features/auth/components/change-password-form"
import { SessionsList } from "@/features/auth/components/sessions-list"

// Exactly what changePasswordSchema enforces, and nothing more. The rules a
// settings page advertises have to be the rules the app actually applies —
// listing complexity requirements nobody checks would just be a lie that
// users discover by being let through anyway.
const PASSWORD_RULES = ["At least 8 characters", "Both new password fields must match"]

/** The Profile tab: your profile picture (when your login has an employee record). */
export function ProfileSettings() {
  const { user } = useCurrentUser()
  if (!user) return null
  if (!user.employeeId) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Your login is not linked to an employee record, so there is no profile picture to set.
        </CardContent>
      </Card>
    )
  }
  return <ProfilePhotoCard employeeId={user.employeeId} />
}

/** The Account tab: your password. */
export function AccountSettings() {
  return <PasswordCard />
}

/**
 * Your own profile picture. Unlike the Edit profile sheet, a change here is saved at once: there is nothing
 * else on the card to save with it.
 */
function ProfilePhotoCard({ employeeId }: { employeeId: string }) {
  const { data: employee } = useEmployee(employeeId)
  const update = useUpdateOwnProfile()
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const photo = employee?.profilePhotoUrl ? `${API_ORIGIN}${employee.profilePhotoUrl}` : null
  const initials = employee ? `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase() : ""

  function choose(file: File | undefined) {
    if (!file) return
    if (!PHOTO_TYPES.includes(file.type)) return setError("Photo must be a PNG, JPG or WebP image.")
    if (file.size > MAX_PHOTO_BYTES) return setError("Photo must be 2 MB or smaller.")
    setError(null)
    update.mutate({ values: null, photo: { kind: "upload", file } })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile picture</CardTitle>
        <CardDescription>Shown on your profile and across the app.</CardDescription>
      </CardHeader>
      <CardContent>
        <input
          ref={inputRef}
          type="file"
          accept={PHOTO_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(event) => {
            choose(event.target.files?.[0])
            event.target.value = "" // lets the same file be picked again
          }}
        />
        <div className="flex flex-wrap items-center gap-4">
          <Avatar className="size-20">
            {photo && <AvatarImage src={photo} alt="Your profile picture" />}
            <AvatarFallback className="bg-role-hr/12 text-xl text-role-hr">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" disabled={update.isPending || !employee}
                      onClick={() => inputRef.current?.click()}>
                <ImageUpIcon className="size-4" />
                {update.isPending ? "Saving…" : photo ? "Replace photo" : "Choose photo"}
              </Button>
              {photo && (
                <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive"
                        disabled={update.isPending} onClick={() => update.mutate({ values: null, photo: { kind: "remove" } })}>
                  <Trash2Icon className="size-4" />
                  Remove
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">PNG, JPG or WebP, up to 2 MB.</p>
          </div>
        </div>
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-destructive" role="alert">
            <TriangleAlertIcon className="size-3.5" /> {error}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function PasswordCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>Use a strong password to keep your account secure.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Form and requirements side by side, stacked on narrow screens —
            the rules stay readable while the fields are filled in rather
            than sitting off the bottom of the card. Both columns are given
            fixed widths rather than 1fr: now that the section nav is a tab
            strip above rather than a column beside, a fractional column
            would stretch the full card and strand the rules panel at the
            far right, yards from the fields it describes. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,24rem)_14rem] lg:items-start lg:justify-start">
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
  )
}

/** The Sessions tab: every device you are signed in on. */
export function SessionsSettings() {
  return (
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
  )
}
