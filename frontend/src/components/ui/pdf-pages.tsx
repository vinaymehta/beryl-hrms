"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "cn"

import { Skeleton } from "@/components/ui/skeleton"

/**
 * PDF.js's 100%: one PDF point is 1/72 in, one CSS pixel 1/96 in — the scale
 * the browser viewers call "100%".
 */
const ACTUAL_SIZE = 96 / 72

/**
 * A PDF drawn page by page onto plain canvases with PDF.js — no viewer around
 * it, so no tool row, sidebar, annotation or print controls in any browser
 * (Firefox ignores the `#toolbar=0` hint the built-in viewers take). Pages sit
 * on white at 100%, one under the other.
 *
 * PDF.js is loaded on first use, so it stays out of every other page's bundle.
 */
export function PdfPages({ src, className }: { src: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<"loading" | "ready" | "error">("loading")

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false
    let destroy: (() => void) | undefined

    async function render() {
      const pdfjs = await import("pdfjs-dist")
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(
          new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url),
          { type: "module" }
        )
      }
      // A server URL needs the session cookie, as every API call sends it;
      // an object URL (the letter, fetched first) has nothing to send.
      const task = pdfjs.getDocument({ url: src, withCredentials: !src.startsWith("blob:") })
      destroy = () => void task.destroy()
      const pdf = await task.promise
      // Sharp on high-density screens: drawn at the device's pixel ratio,
      // shown at 100%.
      const ratio = window.devicePixelRatio || 1
      const canvases: HTMLCanvasElement[] = []

      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number)
        if (cancelled) return
        const viewport = page.getViewport({ scale: ACTUAL_SIZE })
        const canvas = document.createElement("canvas")
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.maxWidth = "100%"
        canvas.style.height = "auto"
        canvas.className = "block bg-white"
        canvas.setAttribute("aria-label", `Page ${number} of ${pdf.numPages}`)
        await page.render({
          canvas,
          viewport,
          transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0],
        }).promise
        canvases.push(canvas)
      }
      if (cancelled) return
      container!.replaceChildren(...canvases)
      setState("ready")
    }

    render().catch(() => {
      if (!cancelled) setState("error")
    })
    return () => {
      cancelled = true
      destroy?.()
    }
  }, [src])

  return (
    <div className={cn("bg-white", className)}>
      {state === "loading" && (
        <div className="mx-auto grid w-full max-w-[794px] gap-3 p-8">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      )}
      {state === "error" && (
        <p className="p-8 text-center text-sm text-muted-foreground">
          Couldn&apos;t show this file. Please try again.
        </p>
      )}
      {/* Pages land here, centred, a hairline between one and the next. */}
      <div
        ref={containerRef}
        role="document"
        className="flex flex-col items-center divide-y divide-border/60"
      />
    </div>
  )
}
