"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { mailApi } from "@/features/mail/api"
import { ApiError } from "@/types/api"
import type { MailConnectionType } from "@/types/mail"

export const MAIL_CONNECTIONS_QUERY_KEY = ["mail", "connections"] as const

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback
}

export function useMailConnections() {
  return useQuery({
    queryKey: MAIL_CONNECTIONS_QUERY_KEY,
    queryFn: mailApi.connections.list,
  })
}

/** Kicks off the real Zoho OAuth handoff — redirects the whole page away.
 *  No date range is involved: history is chosen afterwards, from the Mail
 *  page's own filter. */
export function useConnectMailbox() {
  return useMutation({
    mutationFn: (type: MailConnectionType) => mailApi.connections.connect(type),
    onSuccess: ({ authorizationUrl }) => {
      window.location.href = authorizationUrl
    },
    onError: (error) =>
      toast.error(errorMessage(error, "Couldn't start the connection. Please try again.")),
  })
}

export function useDisconnectMailbox() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: mailApi.connections.disconnect,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MAIL_CONNECTIONS_QUERY_KEY })
      toast.success("Mailbox disconnected.")
    },
    onError: (error) => toast.error(errorMessage(error, "Couldn't disconnect that mailbox.")),
  })
}
