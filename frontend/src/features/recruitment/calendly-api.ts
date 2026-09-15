import { apiClient } from "@/lib/api-client"

export interface CalendlyConnection {
  id: string
  emailAddress: string | null
  status: "active" | "revoked" | "error"
  organizationUri: string | null
  defaultEventTypeUri: string | null
  /** False means bookings will never reach us — the automation is inert. */
  webhookRegistered: boolean
  /** Connected AND an event type chosen; scheduling refuses to run otherwise. */
  ready: boolean
  createdAt: string
}

export interface CalendlyEventType {
  uri: string
  name: string
  schedulingUrl: string | null
  active: boolean
  duration: number | null
}

// Deliberately never exposes tokens — the API doesn't serialize them.
export const calendlyApi = {
  // The shared client unwraps `{data: X}` to X — but its `json?.data ?? json`
  // fallback means `{data: null}` comes back as the ENVELOPE, which is truthy.
  // "Nothing connected" would then render as a connection card full of
  // undefined fields ("Invalid Date", "Needs reconnect"). Normalised here
  // rather than in the shared client, which every other endpoint relies on.
  get: async (): Promise<CalendlyConnection | null> => {
    const res = await apiClient.get<CalendlyConnection | { data: null } | null>("/calendly/connections")
    if (!res || "data" in res) return null
    return res
  },

  // Returns the URL to send the browser to; the OAuth dance happens off-site.
  connect: () => apiClient.post<{ authorizationUrl: string }>("/calendly/connections"),

  eventTypes: () => apiClient.get<CalendlyEventType[]>("/calendly/connections/event_types"),

  setEventType: (eventTypeUri: string) =>
    apiClient.patch<CalendlyConnection>("/calendly/connections/event_type", { eventTypeUri }),

  registerWebhook: () => apiClient.post<CalendlyConnection>("/calendly/connections/register_webhook"),

  disconnect: (id: string) => apiClient.delete<void>(`/calendly/connections/${id}`),
}
