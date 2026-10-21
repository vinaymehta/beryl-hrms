import { CircleDashedIcon, CircleSlashIcon, FileCheck2Icon, LoaderCircleIcon, MailCheckIcon } from "lucide-react"
import { cn } from "cn"

import { isBlocking, shortDate, type SlipState } from "@/features/salary/pay-run"
import type { SalaryEmployee } from "@/types/salary"

const STYLES: Record<SlipState, string> = {
  pending: "bg-muted text-muted-foreground ring-border",
  generated: "bg-info/10 text-info ring-info/20",
  sending: "bg-info/10 text-info ring-info/20",
  sent: "bg-success/12 text-success ring-success/25",
  blocked: "bg-destructive/10 text-destructive ring-destructive/20",
}

/**
 * One row's place in the run, as a pill: Not generated · Generated ·
 * Sending… · Sent 3 Oct · Can't generate: the first blocking reason.
 */
export function SlipStatusPill({
  row,
  state,
  className,
}: {
  row: SalaryEmployee
  state: SlipState
  className?: string
}) {
  const blocker = row.issues.find(isBlocking)
  const [Icon, label, title] = {
    pending: [CircleDashedIcon, "Not generated", undefined],
    generated: [FileCheck2Icon, "Generated", row.slip ? `Generated ${shortDate(row.slip.generatedAt)}` : undefined],
    sending: [LoaderCircleIcon, "Sending…", row.recipientEmail ?? undefined],
    sent: [MailCheckIcon, row.slip?.sentAt ? `Sent ${shortDate(row.slip.sentAt)}` : "Sent", row.slip?.sentTo ?? undefined],
    blocked: [CircleSlashIcon, `Can't generate: ${blocker ?? "not eligible"}`, blocker],
  }[state] as [typeof CircleDashedIcon, string, string | undefined]

  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap ring-1 ring-inset",
        STYLES[state],
        className
      )}
    >
      <Icon className={cn("size-3 shrink-0", state === "sending" && "animate-spin")} />
      <span className="truncate">{label}</span>
    </span>
  )
}
