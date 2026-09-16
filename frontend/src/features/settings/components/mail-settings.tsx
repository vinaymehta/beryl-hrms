"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MailConnectionsSettings } from "@/features/mail/components/mail-connections-settings"

/**
 * Zoho mailbox connections.
 *
 * Handles the redirect back from the Zoho OAuth consent screen (via the
 * backend's callback route) — ?connected=true or ?error=<message> on
 * /settings/mail, which is unchanged.
 */
export function MailSettings() {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast.success("Mailbox connected.")
      window.history.replaceState(null, "", "/settings/mail")
    } else if (searchParams.get("error")) {
      toast.error(searchParams.get("error") || "Couldn't connect that mailbox.")
      window.history.replaceState(null, "", "/settings/mail")
    }
  }, [searchParams])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Zoho Mail</CardTitle>
        <CardDescription>
          Connect your Zoho Mail mailbox to send and receive email from this workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MailConnectionsSettings />
      </CardContent>
    </Card>
  )
}
