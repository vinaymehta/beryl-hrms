"use client"

import * as React from "react"
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip"
import { Popover as PopoverPrimitive } from "@base-ui/react/popover"
import { InfoIcon } from "lucide-react"
import { cn } from "cn"

/**
 * The hover/focus hint primitive, wrapped the same way popover.tsx wraps its
 * own — Portal + Positioner handled here so callers only supply the text, and
 * every tooltip lands with identical geometry and styling.
 *
 * The Positioner sits at z-50, the same layer as Sheet and Dialog. Portals are
 * appended to <body> in mount order, so a tooltip opened from inside a panel
 * is always the later sibling and paints above it.
 */
function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  children,
  side = "top",
  sideOffset = 6,
  align = "center",
  collisionAvoidance,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, "side" | "sideOffset" | "align" | "collisionAvoidance">) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        side={side}
        sideOffset={sideOffset}
        align={align}
        collisionAvoidance={collisionAvoidance}
        className="isolate z-50"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            "max-w-xs origin-(--transform-origin) rounded-lg bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            className
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

/**
 * A small "i" beside a label that holds the field's explanatory sentence, so
 * the sentence doesn't have to sit under the input and push the form's rows
 * out of line with each other.
 *
 * Built on Popover, not Tooltip: it has to open on a CLICK (and a tap on a
 * phone), which a tooltip doesn't do — Base UI's tooltip opens on hover and
 * keyboard focus only. Click or tap opens it; clicking elsewhere or Escape
 * closes it. (Open-on-hover is deliberately off: it swallowed taps on touch
 * screens.)
 *
 * Sits BESIDE the <label>, never inside it — a button nested in a label would
 * become part of the label's text and clicking it would also focus the input.
 */
function InfoTip({
  label,
  children,
  side = "top",
  className,
}: {
  /** The field this explains — read out as "More info about <label>". */
  label: string
  children: React.ReactNode
  side?: PopoverPrimitive.Positioner.Props["side"]
  className?: string
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        type="button"
        aria-label={`More info about ${label}`}
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-popup-open:text-foreground",
          className
        )}
      >
        <InfoIcon className="size-3.5" aria-hidden />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side={side} sideOffset={6} align="center" className="isolate z-50">
          <PopoverPrimitive.Popup
            data-slot="info-tip"
            className="max-w-xs origin-(--transform-origin) rounded-lg bg-popover px-2.5 py-1.5 text-xs leading-relaxed text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
          >
            {children}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, InfoTip }
