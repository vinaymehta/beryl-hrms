import type { Metadata } from "next"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AcceptInvitationForm } from "@/features/auth/components/accept-invitation-form"

export const metadata: Metadata = { title: "Set up your account" }

// Next.js 16: searchParams is async — must be awaited, no synchronous access.
export default async function AcceptInvitationPage({
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
            This invitation link is missing its token. Ask your administrator to send you a new
            one.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return <AcceptInvitationForm token={token} />
}
