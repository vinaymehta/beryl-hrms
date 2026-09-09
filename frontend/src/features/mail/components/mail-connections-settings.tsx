"use client"

import { BuildingIcon, MailIcon, PlugIcon, UnplugIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { usePermission } from "@/features/auth/hooks/use-permission"
import {
  useConnectMailbox,
  useDisconnectMailbox,
  useMailConnections,
} from "@/features/mail/hooks/use-mail-connections"
import { PERMISSIONS } from "@/constants/permissions"
import type { MailConnection, MailConnectionStatus } from "@/types/mail"

const STATUS_BADGE: Record<MailConnectionStatus, { label: string; className: string }> = {
  active: { label: "Connected", className: "bg-success/15 text-success" },
  error: { label: "Needs reconnect", className: "bg-warning/15 text-warning" },
  revoked: { label: "Disconnected", className: "bg-muted text-muted-foreground" },
}

function ConnectionRow({ connection }: { connection: MailConnection }) {
  const disconnect = useDisconnectMailbox()
  const status = STATUS_BADGE[connection.status]

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent-mail/12 text-accent-mail">
          {connection.connectionType === "company_managed" ? (
            <BuildingIcon className="size-4.5" />
          ) : (
            <MailIcon className="size-4.5" />
          )}
        </span>
        <div className="grid gap-0.5">
          <div className="flex items-center gap-2 text-sm font-medium">
            {connection.emailAddress}
            <Badge className={status.className}>{status.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {connection.connectionType === "company_managed" ? "Shared company mailbox" : "Personal mailbox"}
            {connection.lastSyncedAt && ` · last synced ${new Date(connection.lastSyncedAt).toLocaleString()}`}
          </p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={disconnect.isPending}
        onClick={() => disconnect.mutate(connection.id)}
      >
        <UnplugIcon /> Disconnect
      </Button>
    </div>
  )
}

export function MailConnectionsSettings() {
  const { data: connections, isLoading } = useMailConnections()
  const connect = useConnectMailbox()
  const canManageCompanyMailbox = usePermission(PERMISSIONS.zohoConnectionsManage)

  if (isLoading) {
    return (
      <div className="grid gap-2">
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {!connections?.length && (
        <p className="text-sm text-muted-foreground">No mailboxes connected yet.</p>
      )}

      <div className="grid gap-2">
        {connections?.map((connection) => (
          <ConnectionRow key={connection.id} connection={connection} />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={connect.isPending} onClick={() => connect.mutate("individual")}>
          <PlugIcon /> Connect my mailbox
        </Button>
        {canManageCompanyMailbox && (
          <Button variant="outline" disabled={connect.isPending} onClick={() => connect.mutate("company_managed")}>
            <BuildingIcon /> Connect company mailbox
          </Button>
        )}
      </div>
    </div>
  )
}
