"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDownIcon, ChevronRightIcon, RefreshCcwIcon, TriangleAlertIcon } from "lucide-react"
import { cn } from "cn"

import { isBlocking, plural } from "@/features/salary/pay-run"
import type { SalaryEmployee } from "@/types/salary"

/**
 * Who in the run needs something fixed, folded to one line until opened:
 * those whose slip can't be made (no salary, no email address) and those whose
 * slip will print a "--" (no PAN, no bank account) or whose salary has changed
 * since it was generated. Each name links to the employee's page, where the
 * gap is filled in.
 */
export function NeedsAttention({ rows }: { rows: SalaryEmployee[] }) {
  const [open, setOpen] = useState(false)

  const blocked = rows.filter((row) => row.issues.some(isBlocking))
  const warned = rows.filter((row) => !row.issues.some(isBlocking) && (row.issues.length || row.slip?.outdated))
  if (!blocked.length && !warned.length) return null

  const headline = [
    blocked.length && `${plural(blocked.length, "employee", "employees")} can't be paid this run`,
    warned.length && `${plural(warned.length, "warning", "warnings")}`,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <section className="overflow-hidden rounded-xl border border-warning/30 bg-warning/6">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-warning/8"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
          <TriangleAlertIcon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Needs attention</span>
          <span className="block truncate text-xs text-muted-foreground">{headline}</span>
        </span>
        <ChevronDownIcon className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="grid gap-4 border-t border-warning/20 bg-card/60 px-4 py-3 md:grid-cols-2">
          {blocked.length > 0 && (
            <IssueGroup
              title="Can't generate"
              hint="Fix these to include them in the run."
              rows={blocked}
              tone="blocking"
            />
          )}
          {warned.length > 0 && (
            <IssueGroup title="Warnings" hint="Slips can still go; the gap prints as “--”." rows={warned} tone="warning" />
          )}
        </div>
      )}
    </section>
  )
}

function IssueGroup({
  title,
  hint,
  rows,
  tone,
}: {
  title: string
  hint: string
  rows: SalaryEmployee[]
  tone: "blocking" | "warning"
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
        {title} <span className="tabular-nums">({rows.length})</span>
      </p>
      <p className="text-[11px] text-muted-foreground">{hint}</p>
      <ul className="mt-2 max-h-64 divide-y overflow-y-auto rounded-lg border bg-card">
        {rows.map((row) => {
          const issues = tone === "blocking" ? row.issues.filter(isBlocking) : row.issues
          return (
            <li key={row.id}>
              <Link
                href={`/employees/${row.id}`}
                className="group flex items-center gap-2 px-3 py-2 text-sm transition-colors hover:bg-muted/60"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{row.fullName}</span>
                  <span className="mt-0.5 flex flex-wrap gap-1">
                    {issues.map((issue) => (
                      <span
                        key={issue}
                        className={cn(
                          "rounded-full px-1.5 py-px text-[10px] font-medium",
                          tone === "blocking" ? "bg-destructive/10 text-destructive" : "bg-warning/12 text-warning"
                        )}
                      >
                        {issue}
                      </span>
                    ))}
                    {row.slip?.outdated && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-info/10 px-1.5 py-px text-[10px] font-medium text-info">
                        <RefreshCcwIcon className="size-2.5" /> Salary changed since generated
                      </span>
                    )}
                  </span>
                </span>
                <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
