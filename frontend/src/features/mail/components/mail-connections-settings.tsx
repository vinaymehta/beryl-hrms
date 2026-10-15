"use client"

import { useState } from "react"
import {
  BuildingIcon,
  ClockIcon,
  MailIcon,
  PlugIcon,
  PlusIcon,
  RefreshCwIcon,
  Trash2Icon,
  UnplugIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { PERMISSIONS } from "@/constants/permissions"
import { usePermission } from "@/features/auth/hooks/use-permission"
import {
  useConnectMailbox,
  useDisconnectMailbox,
  useMailConnections,
  useReconnectMailbox,
  useRemoveMailbox,
} from "@/features/mail/hooks/use-mail-connections"
import type { MailConnection, MailConnectionStatus } from "@/types/mail"

const STATUS_BADGE: Record<MailConnectionStatus, { label: string; className: string }> = {
  active: { label: "Connected", className: "bg-success/15 text-success" },
  error: { label: "Needs reconnect", className: "bg-warning/15 text-warning" },
  revoked: { label: "Disconnected", className: "bg-muted text-muted-foreground" },
}

function ConnectionRow({ connection, canManage }: { connection: MailConnection; canManage: boolean }) {
  const disconnect = useDisconnectMailbox()
  const reconnect = useReconnectMailbox()
  const remove = useRemoveMailbox()
  const [confirmRemove, setConfirmRemove] = useState(false)
  const status = STATUS_BADGE[connection.status]
  const isCompany = connection.connectionType === "company_managed"
  // Mirrors ZohoConnectionPolicy: company mailboxes need the manage
  // permission; the only personal mailbox anyone sees here is their own.
  const canAct = !isCompany || canManage
  const busy = disconnect.isPending || reconnect.isPending || remove.isPending

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-mail/12 text-accent-mail">
          {isCompany ? <BuildingIcon className="size-4.5" /> : <MailIcon className="size-4.5" />}
        </span>
        <div className="grid min-w-0 gap-0.5">
          <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="truncate">{connection.emailAddress}</span>
            <Badge className={status.className}>{status.label}</Badge>
          </div>
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {isCompany ? "Shared company mailbox" : "Personal mailbox"}
            <span aria-hidden className="max-sm:hidden">·</span>
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3" />
              {connection.lastSyncedAt
                ? `Last scanned ${new Date(connection.lastSyncedAt).toLocaleString()}`
                : "Not scanned yet"}
            </span>
          </p>
        </div>
      </div>
      {/* Connected: Disconnect switches it off but keeps it here. Otherwise
          (disconnected, or Zoho refused it): Reconnect, or Remove to take it
          off the list for good. */}
      {canAct && (
        <div className="flex shrink-0 items-center gap-2">
          {connection.status === "active" ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => disconnect.mutate(connection.id)}>
              <UnplugIcon /> Disconnect
            </Button>
          ) : (
            <>
              <Button size="sm" disabled={busy} onClick={() => reconnect.mutate(connection.id)}>
                <RefreshCwIcon /> Reconnect
              </Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setConfirmRemove(true)}>
                <Trash2Icon /> Remove
              </Button>
            </>
          )}
        </div>
      )}

      <Dialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {connection.emailAddress}?</DialogTitle>
            <DialogDescription>
              It is taken off this list and no longer scanned. Resumes already imported from it stay. To use it
              again, add it as a new account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRemove(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.mutate(connection.id, { onSuccess: () => setConfirmRemove(false) })}
            >
              <Trash2Icon /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export function MailConnectionsSettings() {
  const { data: connections, isLoading } = useMailConnections()
  const connect = useConnectMailbox()
  const canManage = usePermission(PERMISSIONS.zohoConnectionsManage)

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  // A person has at most one personal mailbox — connecting another would
  // replace it — so the personal button only shows until they have one.
  const hasPersonalMailbox = connections?.some((c) => c.connectionType === "individual") ?? false

  return (
    <div className="grid gap-4">
      {!connections?.length && (
        <p className="text-sm text-muted-foreground">No mail accounts connected yet.</p>
      )}

      <div className="grid gap-2">
        {connections?.map((connection) => (
          <ConnectionRow key={connection.id} connection={connection} canManage={canManage} />
        ))}
      </div>

      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          {canManage ? (
            <Button
              variant="outline"
              disabled={connect.isPending}
              onClick={() => connect.mutate("company_managed")}
            >
              <PlusIcon /> Add mail account
            </Button>
          ) : (
            !hasPersonalMailbox && (
              <Button variant="outline" disabled={connect.isPending} onClick={() => connect.mutate("individual")}>
                <PlugIcon /> Connect to mailbox
              </Button>
            )
          )}
        </div>
        {/* Zoho signs in whichever account this browser is already logged in
            to, so without this "Add" would just refresh the account that is
            connected already. */}
        {canManage && (
          <p className="text-xs text-muted-foreground">
            Zoho signs in with the account this browser is logged in to. To add a different account, sign out of
            Zoho first or use a private window.
          </p>
        )}
      </div>
    </div>
  )
}
