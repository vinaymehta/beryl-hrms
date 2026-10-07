"use client"

import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type PointerEvent,
  type Ref,
} from "react"
import { EraserIcon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"

type Point = { x: number; y: number }

export interface SignaturePadHandle {
  clear: () => void
  isEmpty: () => boolean
  /** The signature as a transparent PNG trimmed to the ink, or null when nothing is drawn. */
  toFile: () => Promise<File | null>
}

/** Dark ink on a white pad in both themes — it ends up on a white letter. */
const INK = "#0f172a"
const LINE_WIDTH = 2.5
/** Exported at 3× the on-screen size, whatever the screen, so it prints crisply. */
const EXPORT_SCALE = 3
const EXPORT_PADDING = 8

const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

function prepare(ctx: CanvasRenderingContext2D) {
  ctx.lineWidth = LINE_WIDTH
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  ctx.strokeStyle = INK
  ctx.fillStyle = INK
}

/**
 * One stroke, smoothed: each recorded point becomes the control point of a
 * quadratic curve between the midpoints either side of it, so the line
 * bends through the pointer's path instead of joining it up in straight
 * segments. A single tap is a dot.
 */
function drawStroke(ctx: CanvasRenderingContext2D, stroke: Point[]) {
  if (stroke.length === 0) return
  if (stroke.length === 1) {
    ctx.beginPath()
    ctx.arc(stroke[0].x, stroke[0].y, LINE_WIDTH / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  ctx.beginPath()
  ctx.moveTo(stroke[0].x, stroke[0].y)
  const first = midpoint(stroke[0], stroke[1])
  ctx.lineTo(first.x, first.y)
  for (let i = 1; i < stroke.length - 1; i++) {
    const end = midpoint(stroke[i], stroke[i + 1])
    ctx.quadraticCurveTo(stroke[i].x, stroke[i].y, end.x, end.y)
  }
  const last = stroke[stroke.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

/**
 * A signature drawn with a mouse, finger or pen — a plain <canvas> driven by
 * pointer events, so one code path covers all three.
 *
 *  • `touch-action: none` stops a finger stroke from scrolling the page.
 *  • The backing store is sized to the device pixel ratio, so the ink is
 *    sharp on a high-density screen; the strokes are kept as points and
 *    redrawn whenever the pad is resized.
 *  • `toFile()` re-renders the strokes onto a canvas cropped to the ink and
 *    exports it as a transparent PNG, ready to be placed on the letter.
 *
 * `onChange` reports whether the pad is empty, after every stroke and clear.
 */
export function SignaturePad({
  ref,
  onChange,
  disabled = false,
  className,
  height = 180,
}: {
  ref?: Ref<SignaturePadHandle>
  onChange?: (isEmpty: boolean) => void
  disabled?: boolean
  className?: string
  height?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const strokes = useRef<Point[][]>([])
  // The pointer currently drawing, so a second finger can't splice into the line.
  const activePointer = useRef<number | null>(null)
  const [empty, setEmpty] = useState(true)

  function context() {
    const ctx = canvasRef.current?.getContext("2d") ?? null
    if (ctx) prepare(ctx)
    return ctx
  }

  function redraw() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const ratio = window.devicePixelRatio || 1
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    prepare(ctx)
    for (const stroke of strokes.current) drawStroke(ctx, stroke)
  }

  // Match the backing store to the element's size × the pixel ratio, now and
  // whenever the panel it sits in changes width. Resizing a canvas wipes it,
  // which is why the strokes are kept and redrawn.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const fit = () => {
      const ratio = window.devicePixelRatio || 1
      const { width, height: cssHeight } = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(width * ratio))
      canvas.height = Math.max(1, Math.round(cssHeight * ratio))
      redraw()
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  function pointFrom(event: { clientX: number; clientY: number }): Point {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function notify(isEmpty: boolean) {
    setEmpty(isEmpty)
    onChange?.(isEmpty)
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled || activePointer.current !== null) return
    if (event.pointerType === "mouse" && event.button !== 0) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    activePointer.current = event.pointerId
    strokes.current.push([pointFrom(event)])
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerId !== activePointer.current) return
    const stroke = strokes.current[strokes.current.length - 1]
    const ctx = context()
    if (!stroke || !ctx) return
    // Coalesced events carry the points the browser merged between frames —
    // without them a quick flourish comes out as a few straight chords.
    const events = event.nativeEvent.getCoalescedEvents?.() ?? []
    for (const moved of events.length ? events : [event.nativeEvent]) {
      const point = pointFrom(moved)
      const previous = stroke[stroke.length - 1]
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 1) continue
      stroke.push(point)
      // Draw only the newest piece, exactly as drawStroke would draw it.
      const n = stroke.length
      ctx.beginPath()
      if (n === 2) {
        const end = midpoint(stroke[0], stroke[1])
        ctx.moveTo(stroke[0].x, stroke[0].y)
        ctx.lineTo(end.x, end.y)
      } else {
        const start = midpoint(stroke[n - 3], stroke[n - 2])
        const end = midpoint(stroke[n - 2], stroke[n - 1])
        ctx.moveTo(start.x, start.y)
        ctx.quadraticCurveTo(stroke[n - 2].x, stroke[n - 2].y, end.x, end.y)
      }
      ctx.stroke()
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLCanvasElement>) {
    if (event.pointerId !== activePointer.current) return
    activePointer.current = null
    const stroke = strokes.current[strokes.current.length - 1]
    const ctx = context()
    if (stroke && ctx) {
      if (stroke.length === 1) {
        drawStroke(ctx, stroke)
      } else {
        // The tail from the last midpoint to where the pointer lifted.
        const n = stroke.length
        const start = midpoint(stroke[n - 2], stroke[n - 1])
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(stroke[n - 1].x, stroke[n - 1].y)
        ctx.stroke()
      }
    }
    notify(strokes.current.length === 0)
  }

  function clear() {
    strokes.current = []
    activePointer.current = null
    redraw()
    notify(true)
  }

  async function toFile(): Promise<File | null> {
    const points = strokes.current.flat()
    if (points.length === 0) return null
    const pad = LINE_WIDTH + EXPORT_PADDING
    const minX = Math.min(...points.map((p) => p.x)) - pad
    const minY = Math.min(...points.map((p) => p.y)) - pad
    const maxX = Math.max(...points.map((p) => p.x)) + pad
    const maxY = Math.max(...points.map((p) => p.y)) + pad

    const out = document.createElement("canvas")
    out.width = Math.ceil((maxX - minX) * EXPORT_SCALE)
    out.height = Math.ceil((maxY - minY) * EXPORT_SCALE)
    const ctx = out.getContext("2d")
    if (!ctx) return null
    // Nothing is painted behind the ink, so the PNG stays transparent.
    ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, -minX * EXPORT_SCALE, -minY * EXPORT_SCALE)
    prepare(ctx)
    for (const stroke of strokes.current) drawStroke(ctx, stroke)

    const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, "image/png"))
    return blob ? new File([blob], "signature.png", { type: "image/png" }) : null
  }

  useImperativeHandle(ref, () => ({
    clear,
    isEmpty: () => strokes.current.length === 0,
    toFile,
  }))

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg border bg-white",
        disabled && "opacity-60",
        className
      )}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={empty ? "Signature pad — draw your signature here" : "Your drawn signature"}
        className={cn(
          "block w-full touch-none select-none",
          disabled ? "cursor-not-allowed" : "cursor-crosshair"
        )}
        style={{ height, touchAction: "none" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />

      {/* A signing line, and a prompt while the pad is blank. Decorative only:
          neither is part of the exported image. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-6 bottom-10 border-b border-dashed border-slate-300"
      />
      {empty && (
        <p
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-slate-400"
        >
          Sign above the line
        </p>
      )}

      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="absolute top-1.5 right-1.5 gap-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        disabled={disabled || empty}
        onClick={clear}
      >
        <EraserIcon /> Clear
      </Button>
    </div>
  )
}
