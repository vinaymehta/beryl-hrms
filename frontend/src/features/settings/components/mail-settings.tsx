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
      // outcome comes from the backend callback: a brand-new row, the same
      // account connected again (its existing row refreshed), or a reconnect.
      const outcome = searchParams.get("outcome")
      toast.success(
        outcome === "reconnected"
          ? "Mail account reconnected."
          : outcome === "refreshed"
            ? "That mail account was already connected — its sign-in has been refreshed."
            : "Mail account connected."
      )
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
          Connect the Zoho Mail accounts this workspace reads and scans for incoming resumes. Replies and new mail
          written on the Mail page are sent from them.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MailConnectionsSettings />
      </CardContent>
    </Card>
  )
}
