import { cn } from "cn"

export const BRAND_NAME = "Beryl Systems"

/**
 * The company mark — the BS roundel and the BERYL SYSTEMS wordmark — used
 * everywhere the product names itself (sidebar, mobile nav, sign-in pages).
 * One component so a change to the logo is a change in one place.
 *
 * A plain <img>, not next/image: it is a tiny fixed asset, and the optimizer
 * would only add a request in front of it.
 */
export function BrandMark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/brand/beryl-logo.png"
        alt=""
        aria-hidden
        className={cn(
          "shrink-0 rounded-full dark:ring-1 dark:ring-white/25",
          size === "lg" ? "size-10" : "size-8"
        )}
      />
      <span
        className={cn(
          // Helvetica/Arial, not the app's Geist: it matches the company's own
          // wordmark, and Geist's capital T sits apart from its neighbours in
          // all-caps text ("SYST EMS").
          "font-bold tracking-wide whitespace-nowrap text-foreground uppercase",
          size === "lg" ? "text-lg" : "text-[15px]"
        )}
        style={{ fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}
      >
        {BRAND_NAME}
      </span>
    </span>
  )
}
