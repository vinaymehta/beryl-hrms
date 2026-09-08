import type { ReactNode } from "react"

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-background p-6">
      {/* Soft, controlled brand wash — decorative only, purely background */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full bg-primary/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full bg-accent-foreground/20 blur-3xl"
      />

      <div className="relative flex items-center gap-2.5 text-lg font-semibold tracking-tight">
        <span className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent-foreground text-primary-foreground shadow-lg shadow-primary/30">
          H
        </span>
        HR Platform
      </div>
      <div className="relative w-full max-w-sm">{children}</div>
    </div>
  )
}
