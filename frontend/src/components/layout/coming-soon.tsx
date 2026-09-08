import { ConstructionIcon, SparklesIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

/**
 * Per-module accent so each area of the app reads as its own workspace even
 * before its real UI exists (brief: "each module has its own visual
 * personality") — literal class strings, not interpolated, since Tailwind's
 * static scanner can't see classes assembled at runtime (see
 * ROLE_BADGE_CLASSES in constants/permissions.ts for the same constraint).
 */
const ACCENT_CLASSES = {
  hr: { icon: "bg-role-hr/12 text-role-hr", ring: "from-role-hr/40 to-role-hr/0" },
  mail: { icon: "bg-primary/12 text-primary", ring: "from-primary/40 to-primary/0" },
  admin: { icon: "bg-role-admin/12 text-role-admin", ring: "from-role-admin/40 to-role-admin/0" },
} as const

export function ComingSoon({
  title,
  description = "This area is coming in a later phase.",
  icon: Icon = ConstructionIcon,
  accent = "hr",
}: {
  title: string
  description?: string
  icon?: LucideIcon
  accent?: keyof typeof ACCENT_CLASSES
}) {
  const classes = ACCENT_CLASSES[accent]

  return (
    <div className="relative flex min-h-[50vh] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border bg-gradient-to-b from-surface-muted to-surface p-8 text-center">
      <div
        aria-hidden
        className={cn("pointer-events-none absolute -top-16 size-48 rounded-full bg-gradient-to-b blur-2xl", classes.ring)}
      />
      <span className={cn("relative flex size-14 items-center justify-center rounded-2xl", classes.icon)}>
        <Icon className="size-7" />
      </span>
      <h2 className="relative text-lg font-semibold">{title}</h2>
      <p className="relative max-w-sm text-sm text-muted-foreground">{description}</p>
      <p className="relative mt-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
        <SparklesIcon className="size-3.5" /> Coming soon
      </p>
    </div>
  )
}
