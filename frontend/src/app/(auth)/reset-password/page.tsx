import type { Metadata } from "next"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form"

export const metadata: Metadata = { title: "Reset password" }

// Next.js 16: searchParams is async — must be awaited, no synchronous access.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams

  if (!token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Invalid link</CardTitle>
          <CardDescription>
            This password reset link is missing its token. Request a new one from the forgot
            password page.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <ResetPasswordForm token={token} />
}
