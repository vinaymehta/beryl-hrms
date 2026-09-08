import type { Metadata } from "next"

import { VerifyEmailView } from "@/features/auth/components/verify-email-view"

export const metadata: Metadata = { title: "Verify your email" }

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const { token } = await searchParams
  return <VerifyEmailView token={token} />
}
