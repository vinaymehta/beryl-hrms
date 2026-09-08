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
        className="pointer-events-none absolute -top-16 size-48 rounded-full bg-gradient-to-b from-primary/40 to-primary/0 blur-2xl"
      />
      <span className="relative flex size-14 items-center justify-center rounded-2xl bg-primary/12 text-primary">
        <MailIcon className="size-7" />
      </span>
      <h2 className="relative text-lg font-semibold">Connect your mailbox</h2>
      <p className="relative max-w-sm text-sm text-muted-foreground">
        Connect a Zoho Mail account to read and search mail without leaving the app. You can
        connect your own mailbox, or an admin can connect a shared company mailbox from Settings.
      </p>
      <Button
        className="relative mt-2"
        disabled={connect.isPending}
        onClick={() => connect.mutate("individual")}
      >
        <PlugIcon />
        {connect.isPending ? "Connecting…" : "Connect my mailbox"}
      </Button>
    </div>
  )
}
