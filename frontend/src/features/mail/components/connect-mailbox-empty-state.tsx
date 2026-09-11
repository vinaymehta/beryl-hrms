"use client"

import { MailIcon, PlugIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { useConnectMailbox } from "@/features/mail/hooks/use-mail-connections"

export function ConnectMailboxEmptyState() {
  const connect = useConnectMailbox()

  return (
    <div className="relative flex min-h-[50vh] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-b from-surface-muted to-surface p-8 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 size-48 rounded-full bg-gradient-to-b from-accent-mail/40 to-accent-mail/0 blur-2xl"
      />
      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-accent-mail/12 text-accent-mail">
        <MailIcon className="size-7" />
      </span>
      <h2 className="relative text-lg font-semibold">Connect your mailbox</h2>
      <p className="relative max-w-sm text-sm text-muted-foreground">
        Connect a Zoho Mail account to read and search mail without leaving the app.
      </p>
      <Button
        className="relative mt-2"
        disabled={connect.isPending}
        onClick={() => connect.mutate("individual")}
      >
        <PlugIcon />
        {connect.isPending ? "Connecting…" : "Connect to mailbox"}
      </Button>
    </div>
  )
}
