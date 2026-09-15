"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { calendlyApi } from "@/features/recruitment/calendly-api"
import {
  CalendarClockIcon,
  PlugIcon,
  UnplugIcon,
  CheckCircle2Icon,
  AlertTriangleIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react"
import { cn } from "cn"

/**
 * Connect the company's Calendly account, and choose which event type
 * interviews are booked against.
 *
 * This is the landing route for the OAuth callback (the backend redirects here
 * with ?connected=true or ?error=...), mirroring how /settings/mail handles the
 * Zoho return.
 */
export default function SettingsInterviewsPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [selectedEventType, setSelectedEventType] = useState("")

  const { data: connection, isLoading } = useQuery({
    queryKey: ["calendly", "connection"],
    queryFn: calendlyApi.get,
  })

  // Event types are only fetchable once an account is connected — asking for
  // them first would just 401 against Calendly.
  const { data: eventTypes, isLoading: typesLoading } = useQuery({
    queryKey: ["calendly", "event-types"],
    queryFn: calendlyApi.eventTypes,
    enabled: Boolean(connection && connection.status === "active"),
  })

  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast.success("Calendly connected.")
      queryClient.invalidateQueries({ queryKey: ["calendly"] })
      router.replace("/settings/interviews")
    } else if (searchParams.get("error")) {
      toast.error(searchParams.get("error") || "Couldn't connect Calendly.")
      router.replace("/settings/interviews")
    }
  }, [searchParams, router, queryClient])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["calendly"] })

  const connect = useMutation({
    mutationFn: calendlyApi.connect,
    // The OAuth consent screen lives on Calendly, so this deliberately leaves
    // the app rather than opening a dialog.
    onSuccess: (data) => {
      window.location.href = data.authorizationUrl
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't start the Calendly connection"),
  })

  const setEventType = useMutation({
    mutationFn: (uri: string) => calendlyApi.setEventType(uri),
    onSuccess: () => {
      toast.success("Interview event type saved.")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save the event type"),
  })

  const registerWebhook = useMutation({
    mutationFn: calendlyApi.registerWebhook,
    onSuccess: () => {
      toast.success("Calendly will now notify us about bookings.")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't register the webhook"),
  })

  const disconnect = useMutation({
    mutationFn: (id: string) => calendlyApi.disconnect(id),
    onSuccess: () => {
      toast.info("Calendly disconnected.")
      invalidate()
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't disconnect"),
  })

  const activeEventType = eventTypes?.find((t) => t.uri === (selectedEventType || connection?.defaultEventTypeUri))

  return (
    <div className="grid max-w-2xl gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Interview scheduling</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-role-recruitment/12 text-role-recruitment">
              <CalendarClockIcon className="size-4" />
            </span>
            Calendly
          </CardTitle>
          <CardDescription>
            Shortlisted candidates are emailed a link to book their own interview slot. Calendly owns the availability —
            set your working-day slots on the event type you choose below.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-lg" />
          ) : !connection || connection.status === "revoked" ? (
            <div className="space-y-3 rounded-lg border border-dashed p-6 text-center">
              <PlugIcon className="mx-auto size-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No Calendly account connected</p>
              <p className="text-xs text-muted-foreground">
                Interviews can&apos;t be scheduled until an account is connected.
              </p>
              <Button onClick={() => connect.mutate()} disabled={connect.isPending} className="gap-1.5">
                {connect.isPending ? <Loader2Icon className="size-4 animate-spin" /> : <PlugIcon className="size-4" />}
                Connect Calendly
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {connection.emailAddress || "Calendly account"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Connected {new Date(connection.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      connection.status === "active"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600"
                    )}
                  >
                    {connection.status === "active" ? "Connected" : "Needs reconnect"}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => disconnect.mutate(connection.id)}
                    disabled={disconnect.isPending}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                  >
                    <UnplugIcon className="size-3.5" />
                    Disconnect
                  </Button>
                </div>
              </div>

              {/* Which event type booking links are generated from. Its own
                  availability rules are what produce the bookable slots. */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Interview event type
                </p>
                <div className="flex items-center gap-2">
                  <Select
                    items={(eventTypes ?? []).map((t) => ({ value: t.uri, label: t.name }))}
                    value={selectedEventType || connection.defaultEventTypeUri || ""}
                    onValueChange={(v) => setSelectedEventType(v == null ? "" : String(v))}
                  >
                    <SelectTrigger aria-label="Interview event type" className="flex-1">
                      <SelectValue placeholder={typesLoading ? "Loading event types…" : "Choose an event type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {(eventTypes ?? []).map((t) => (
                        <SelectItem key={t.uri} value={t.uri}>
                          {t.name}
                          {t.duration ? ` — ${t.duration} min` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={() => setEventType.mutate(selectedEventType)}
                    disabled={!selectedEventType || selectedEventType === connection.defaultEventTypeUri || setEventType.isPending}
                  >
                    {setEventType.isPending ? <Loader2Icon className="size-3.5 animate-spin" /> : "Save"}
                  </Button>
                </div>
                {!connection.defaultEventTypeUri && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Pick one — booking links can&apos;t be generated until an event type is chosen.
                  </p>
                )}
                {activeEventType?.schedulingUrl && (
                  <p className="truncate text-[11px] text-muted-foreground">{activeEventType.schedulingUrl}</p>
                )}
              </div>

              {/* Without a subscription the integration is connected but deaf:
                  bookings never set Interview Scheduled and cancellations never
                  reject. Surfaced rather than left to fail silently. */}
              <div
                className={cn(
                  "flex items-start justify-between gap-3 rounded-lg border p-3",
                  connection.webhookRegistered ? "bg-muted/20" : "border-amber-500/30 bg-amber-500/10"
                )}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {connection.webhookRegistered ? (
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-emerald-500" />
                  ) : (
                    <AlertTriangleIcon className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  )}
                  <div className="min-w-0 text-xs">
                    <p className="font-medium text-foreground">
                      {connection.webhookRegistered ? "Booking notifications active" : "Booking notifications not set up"}
                    </p>
                    <p className="text-muted-foreground">
                      {connection.webhookRegistered
                        ? "Calendly tells us when a candidate books or cancels, which is what moves them to Interview Scheduled or Rejected."
                        : "Until this is registered, bookings won't change any candidate's status. Calendly must be able to reach this server over the public internet."}
                    </p>
                  </div>
                </div>
                {!connection.webhookRegistered && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => registerWebhook.mutate()}
                    disabled={registerWebhook.isPending}
                    className="shrink-0 gap-1.5 text-xs"
                  >
                    {registerWebhook.isPending ? (
                      <Loader2Icon className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCwIcon className="size-3.5" />
                    )}
                    Retry
                  </Button>
                )}
              </div>

              {connection.ready && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2Icon className="size-3.5" />
                  Ready — shortlisted candidates can now be sent booking links.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
