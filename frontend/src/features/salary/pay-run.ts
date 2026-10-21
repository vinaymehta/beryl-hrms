import type { SalaryEmployee } from "@/types/salary"

/**
 * What stops a slip being generated or sent (Salary::Run::BLOCKING). Every
 * other issue — no PAN, no bank account — is a warning: the slip prints "--"
 * in its place.
 */
export const BLOCKING_ISSUES = ["Not an active employee", "No salary on file", "No email address on file"]

export const isBlocking = (issue: string) => BLOCKING_ISSUES.includes(issue)

/**
 * Where one employee's slip is in this month's run. "sending" is the page's
 * own state: the slip has been queued for email and the job hasn't marked it
 * sent yet.
 */
export type SlipState = "blocked" | "pending" | "generated" | "sending" | "sent"

export function slipState(row: SalaryEmployee, sending: ReadonlySet<number>): SlipState {
  if (row.slip?.status === "sent") return "sent"
  if (row.slip && sending.has(row.slip.id)) return "sending"
  if (row.slip) return "generated"
  return row.eligible ? "pending" : "blocked"
}

/** The status tabs over the table. */
export type RunFilter = "all" | "pending" | "generated" | "sent" | "attention"

export function needsAttention(row: SalaryEmployee) {
  return row.issues.length > 0 || !!row.slip?.outdated
}

export function matchesFilter(row: SalaryEmployee, filter: RunFilter) {
  switch (filter) {
    case "all":
      return true
    case "pending":
      return row.eligible && !row.slip
    case "generated":
      return row.slip?.status === "generated"
    case "sent":
      return row.slip?.status === "sent"
    case "attention":
      return needsAttention(row)
  }
}

export function matchesSearch(row: SalaryEmployee, query: string) {
  if (!query) return true
  return [row.fullName, row.employeeCode, row.designationTitle, row.departmentName, row.recipientEmail].some(
    (value) => value?.toLowerCase().includes(query)
  )
}

/** Can be generated now — or regenerated, if it hasn't been sent. */
export const canGenerate = (row: SalaryEmployee) => row.eligible && row.slip?.status !== "sent"

/** A generated slip with somewhere to go, not yet sent. */
export const canSend = (row: SalaryEmployee) => row.eligible && row.slip?.status === "generated"

/** The figures to show: the slip's own once generated, else the projection. */
export function rowAmounts(row: SalaryEmployee) {
  if (row.slip) return { gross: row.slip.gross, deductions: row.slip.deductions, net: row.slip.net }
  if (row.monthlyGross === null) return null
  return { gross: row.monthlyGross, deductions: row.monthlyDeductions ?? 0, net: row.monthlyNet ?? 0 }
}

/** How far back the month picker reaches. */
const MONTHS_BACK = 12

const monthLabelFormat = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric" })

function monthValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/**
 * This month and the twelve before it, newest first. Nothing later: the API
 * refuses a slip for a month that hasn't begun.
 */
export function monthOptions(today: Date) {
  return Array.from({ length: MONTHS_BACK + 1 }, (_, back) => {
    const date = new Date(today.getFullYear(), today.getMonth() - back, 1)
    return { value: monthValue(date), label: monthLabelFormat.format(date) }
  })
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" })
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
})

export const shortDate = (iso: string) => dateFormat.format(new Date(iso))
export const dateTime = (iso: string) => dateTimeFormat.format(new Date(iso))

export function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return `${parts[0]?.[0] ?? ""}${parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : ""}`.toUpperCase()
}
