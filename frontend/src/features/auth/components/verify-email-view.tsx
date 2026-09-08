"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { MailIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useVerifyEmail } from "@/features/auth/hooks/use-auth-mutations"

export function VerifyEmailView({ token }: { token?: string }) {
  const verifyEmail = useVerifyEmail()
  const attempted = useRef(false)

  useEffect(() => {
    if (token && !attempted.current) {
      attempted.current = true
      verifyEmail.mutate(token)
    }
  }, [token, verifyEmail])

  if (!token) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-info/12">
            <MailIcon className="size-6 text-info" />
          </span>
          <CardTitle>Check your inbox</CardTitle>
          <CardDescription>
            We&apos;ve sent a verification link to your email. Click it to activate your account.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (verifyEmail.isPending || verifyEmail.isIdle) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle>Verifying your email…</CardTitle>
        </CardHeader>
      </Card>
    )
  }

  if (verifyEmail.isError) {
    return (
      <Card>
        <CardHeader className="items-center text-center">
          <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-danger/12">
            <XCircleIcon className="size-6 text-danger" />
          </span>
          <CardTitle>Verification failed</CardTitle>
          <CardDescription>
            This link is invalid or has expired. You can request a new one from your account
            settings once signed in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
            Back to sign in
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="items-center text-center">
        <span className="mb-2 flex size-12 items-center justify-center rounded-full bg-success/12">
          <CheckCircle2Icon className="size-6 text-success" />
        </span>
        <CardTitle>Email verified</CardTitle>
        <CardDescription>Your account is fully activated.</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button nativeButton={false} render={<Link href="/" />}>Go to dashboard</Button>
      </CardContent>
    </Card>
  )
}
