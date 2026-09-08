"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MailConnectionsSettings } from "@/features/mail/components/mail-connections-settings"

// Handles the redirect back from the real Zoho OAuth consent screen (via the
// backend's callback route) — ?connected=true or ?error=<message> on this
// exact page. Default assumed here; confirm against whatever the backend's
// Phase 4 work actually redirects to once both sides are done.
export default function SettingsMailPage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast.success("Mailbox connected.")
      router.replace("/settings/mail")
    } else if (searchParams.get("error")) {
      toast.error(searchParams.get("error") || "Couldn't connect that mailbox.")
      router.replace("/settings/mail")
    }
  }, [searchParams, router])

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Mail connections</h1>
      <Card>
        <CardHeader>
          <CardTitle>Zoho Mail</CardTitle>
          <CardDescription>
            Connect a personal mailbox, or a shared company mailbox if you manage this workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MailConnectionsSettings />
        </CardContent>
      </Card>
    </div>
  )
}
