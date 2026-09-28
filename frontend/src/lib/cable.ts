import { API_ORIGIN } from "@/lib/api-client"

/**
 * A minimal Action Cable client on the browser's own WebSocket.
 *
 * Written rather than installed: the protocol is a handful of JSON frames —
 * `welcome`, `ping` every 3s, `confirm_subscription`, then messages tagged with
 * the subscription's identifier — and this is all the app uses it for.
 *
 * The socket authenticates with the same session cookie the API uses
 * (ApplicationCable::Connection), so it is opened against the API's origin.
 * One shared socket carries every subscription; it reconnects with backoff
 * and treats a missed heartbeat as a dead connection.
 */

type Handlers = {
  received: (message: unknown) => void
  /** Called on every (re)connect, so a caller can catch up on what it missed. */
  connected?: () => void
}

const PING_TIMEOUT_MS = 10_000
const MAX_BACKOFF_MS = 30_000

function cableUrl() {
  if (API_ORIGIN) return `${API_ORIGIN.replace(/^http/, "ws")}/cable`
  const scheme = window.location.protocol === "https:" ? "wss" : "ws"
  return `${scheme}://${window.location.host}/cable`
}

const subscriptions = new Map<string, Set<Handlers>>()
let socket: WebSocket | null = null
let retries = 0
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let heartbeatTimer: ReturnType<typeof setTimeout> | null = null

function send(frame: Record<string, unknown>) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame))
}

function resetHeartbeat() {
  if (heartbeatTimer) clearTimeout(heartbeatTimer)
  // Silence past a few pings means the connection is gone even if the socket
  // hasn't noticed yet (sleep, network change) — drop it and reconnect.
  heartbeatTimer = setTimeout(() => socket?.close(), PING_TIMEOUT_MS)
}

function connect() {
  if (socket || subscriptions.size === 0) return

  const ws = new WebSocket(cableUrl(), ["actioncable-v1-json"])
  socket = ws

  ws.onmessage = (event) => {
    let frame: { type?: string; identifier?: string; message?: unknown }
    try {
      frame = JSON.parse(String(event.data))
    } catch {
      return
    }
    resetHeartbeat()

    if (frame.type === "welcome") {
      retries = 0
      for (const identifier of subscriptions.keys()) send({ command: "subscribe", identifier })
      return
    }
    if (frame.type === "confirm_subscription" && frame.identifier) {
      subscriptions.get(frame.identifier)?.forEach((h) => h.connected?.())
      return
    }
    if (frame.type === "disconnect") {
      ws.close()
      return
    }
    if (frame.type || !frame.identifier) return // ping, reject_subscription, …

    subscriptions.get(frame.identifier)?.forEach((h) => h.received(frame.message))
  }

  ws.onclose = () => {
    if (socket === ws) socket = null
    if (heartbeatTimer) clearTimeout(heartbeatTimer)
    if (subscriptions.size === 0) return
    const delay = Math.min(1000 * 2 ** retries, MAX_BACKOFF_MS)
    retries += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }
}

/** Subscribe to a channel. Returns the unsubscribe function. */
export function subscribe(channel: string, handlers: Handlers): () => void {
  const identifier = JSON.stringify({ channel })
  const existing = subscriptions.get(identifier)

  if (existing) {
    existing.add(handlers)
  } else {
    subscriptions.set(identifier, new Set([ handlers ]))
    send({ command: "subscribe", identifier })
  }
  connect()

  return () => {
    const set = subscriptions.get(identifier)
    if (!set) return
    set.delete(handlers)
    if (set.size > 0) return

    subscriptions.delete(identifier)
    send({ command: "unsubscribe", identifier })
    if (subscriptions.size === 0) {
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
      socket = null
    }
  }
}
