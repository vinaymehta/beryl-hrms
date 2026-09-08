import { AlertTriangleIcon, ClockIcon } from "lucide-react"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

/**
 * The two mail-specific failure states the brief calls out by name — a
 * generic error toast would bury what's actually wrong and, for the
 * reauth case, leave the user with no way forward.
 */
export function MailReauthAlert({ onReconnect, pending }: { onReconnect: () => void; pending: boolean }) {
  return (
    <Alert variant="destructive" className="border-warning/30 bg-warning/10 text-warning-foreground">
      <AlertTriangleIcon className="text-warning" />
      <AlertTitle>This mailbox needs to be reconnected</AlertTitle>
      <AlertDescription className="text-warning-foreground/80">
        Zoho access expired or was revoked. Reconnect to keep reading and searching this mailbox.
      </AlertDescription>
      <Button size="sm" className="col-start-2 mt-1 w-fit" disabled={pending} onClick={onReconnect}>
        {pending ? "Reconnecting…" : "Reconnect"}
      </Button>
    </Alert>
  )
}

export function MailRateLimitedAlert() {
  return (
    <Alert className="border-info/30 bg-info/10">
      <ClockIcon className="text-info" />
      <AlertTitle>Zoho is temporarily rate-limiting requests</AlertTitle>
      <AlertDescription>Try again in a moment.</AlertDescription>
    </Alert>
  )
}
