"use client"

import { useEffect, useRef } from "react"
import { useForm } from "react-hook-form"
import { useQuery } from "@tanstack/react-query"
import { zodResolver } from "@hookform/resolvers/zod"
import { MailCheckIcon, TriangleAlertIcon } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/ui/password-input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Skeleton } from "@/components/ui/skeleton"
import { authApi } from "@/features/auth/api"
import { acceptInvitationSchema, type AcceptInvitationValues } from "@/features/auth/schemas"
import { useAcceptInvitation } from "@/features/auth/hooks/use-auth-mutations"

/**
 * First login for an employee an Admin invited.
 *
 * The link is looked up before the form is shown, for two reasons. It lets the
 * page greet the person by name and confirm which address they are claiming —
 * reassurance that matters when the only thing they have is a link out of an
 * email. And it turns an expired invitation into a plain sentence up front
 * instead of a failure after they have chosen and typed a password twice.
 *
 * No password is ever supplied TO this page. When one is asked for, the
 * employee chooses it here and it is the first this account has had — which is
 * what makes an administrator structurally unable to know it.
 *
 * Whether it is asked for at all is Admin's call, via "Force password update"
 * beside the Invite button:
 *
 *   ticked    the form below; they cannot get in without choosing one.
 *   unticked  no form. The link was emailed to them and works once, so it is
 *             itself the proof of identity — it just signs them in and drops
 *             them on their profile. They can set a password whenever they
 *             like from Settings, and until they do, Forgot password is how
 *             they get back in. The page says so rather than letting them
 *             find out at the next sign-in.
 */
export function AcceptInvitationForm({ token }: { token: string }) {
  const acceptInvitation = useAcceptInvitation()
  const invitation = useQuery({
    queryKey: ["auth", "invitation", token],
    queryFn: () => authApi.invitation(token),
    // A bad link is a bad link: retrying it just delays telling them so.
    retry: false,
  })

  const form = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: { password: "", passwordConfirmation: "" },
  })

  function onSubmit(values: AcceptInvitationValues) {
    acceptInvitation.mutate({
      token,
      password: values.password,
      passwordConfirmation: values.passwordConfirmation,
    })
  }

  // No password required: spend the link and let them in, without making them
  // press a button whose only possible answer is yes.
  //
  // The ref guards against firing twice — React runs effects twice in
  // development's strict mode, and the second call would hit an
  // already-spent token and show a failure for something that worked.
  const autoAccepted = useRef(false)
  const skipsPassword = invitation.data?.mustSetPassword === false
  useEffect(() => {
    if (!skipsPassword || autoAccepted.current) return
    autoAccepted.current = true
    acceptInvitation.mutate({ token })
    // acceptInvitation is a stable mutation object; including it would re-run
    // this on every render of a pending mutation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skipsPassword, token])

  if (invitation.isPending) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-56" />
        </CardHeader>
        <CardContent className="grid gap-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (invitation.isError) {
    return (
      <Card>
        <CardHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-warning/15 text-warning">
            <TriangleAlertIcon className="size-5" />
          </span>
          <CardTitle className="text-xl">This invitation can&apos;t be used</CardTitle>
          <CardDescription>
            It may have expired, already been used, or been replaced by a newer one. Ask your
            administrator to send a fresh invitation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" className="w-full" nativeButton={false} render={<Link href="/login" />}>
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (skipsPassword) {
    return (
      <Card>
        <CardHeader>
          <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent-foreground text-primary-foreground shadow-sm shadow-primary/30">
            <MailCheckIcon className="size-5" />
          </span>
          <CardTitle className="text-xl">Welcome, {invitation.data.firstName}</CardTitle>
          <CardDescription>
            Signing you in to {invitation.data.companyName ?? "your workspace"}…
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Skeleton className="h-8 w-full" />
          {/* Said here, once, rather than left to be discovered at the next
              sign-in: this account has no password yet. */}
          <p className="text-xs text-muted-foreground">
            You haven&apos;t set a password yet. You can add one any time from Settings — until
            then, use &quot;Forgot password&quot; on the sign-in page to get back in.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent-foreground text-primary-foreground shadow-sm shadow-primary/30">
          <MailCheckIcon className="size-5" />
        </span>
        <CardTitle className="text-xl">
          Welcome, {invitation.data.firstName}
        </CardTitle>
        <CardDescription>
          {invitation.data.companyName
            ? `You've been invited to ${invitation.data.companyName}. `
            : ""}
          Choose a password for {invitation.data.email} to finish setting up your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Create password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="passwordConfirmation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm password</FormLabel>
                  <FormControl>
                    <PasswordInput autoComplete="new-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* See login-form.tsx: Base UI's Button forces type="button"
                internally, so the click needs an explicit handler alongside
                the form's onSubmit. */}
            <Button
              type="submit"
              className="w-full"
              disabled={acceptInvitation.isPending}
              onClick={form.handleSubmit(onSubmit)}
            >
              {acceptInvitation.isPending ? "Setting up…" : "Set password and sign in"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
