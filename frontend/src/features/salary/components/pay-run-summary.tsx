import { BanknoteIcon, MailCheckIcon, MinusCircleIcon, UsersIcon, WalletIcon, type LucideIcon } from "lucide-react"
import { cn } from "cn"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { rupees } from "@/features/appraisals/salary-structure"
import type { SalaryRunSummary } from "@/types/salary"

interface Stat {
  key: string
  label: string
  value: string
  caption: string
  icon: LucideIcon
  iconTint: string
  wash: string
}

/**
 * The run in five numbers, in the Recruitment page's Quick Stats look. The
 * money is generated slips' own figures plus what the eligible rest would be
 * paid, so the totals hold steady from the first generate to the last send.
 */
export function PayRunSummary({ summary, isLoading }: { summary?: SalaryRunSummary; isLoading: boolean }) {
  const stats: Stat[] = summary
    ? [
        {
          key: "employees",
          label: "Employees in run",
          value: String(summary.eligible),
          caption: `${summary.withSalary} of ${summary.employees} with salary on file`,
          icon: UsersIcon,
          iconTint: "bg-role-hr text-role-hr-foreground",
          wash: "bg-role-hr/8 border-role-hr/15",
        },
        {
          key: "gross",
          label: "Gross pay",
          value: rupees.format(summary.totalGross),
          caption: "Before deductions",
          icon: BanknoteIcon,
          iconTint: "bg-role-accounts text-role-accounts-foreground",
          wash: "bg-role-accounts/8 border-role-accounts/15",
        },
        {
          key: "deductions",
          label: "Deductions",
          value: rupees.format(summary.totalDeductions),
          caption: "PF and other deductions",
          icon: MinusCircleIcon,
          iconTint: "bg-warning text-warning-foreground",
          wash: "bg-warning/8 border-warning/15",
        },
        {
          key: "net",
          label: "Net pay",
          value: rupees.format(summary.totalNet),
          caption: "Paid to employees",
          icon: WalletIcon,
          iconTint: "bg-role-admin text-role-admin-foreground",
          wash: "bg-role-admin/8 border-role-admin/15",
        },
        {
          key: "sent",
          label: "Slips sent",
          value: `${summary.sent}/${summary.generated}`,
          caption: summary.generated ? `${summary.generated - summary.sent} still to send` : "None generated yet",
          icon: MailCheckIcon,
          iconTint: "bg-success text-success-foreground",
          wash: "bg-success/8 border-success/15",
        },
      ]
    : []

  if (isLoading || !summary) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className={cn("h-26 rounded-xl", i === 4 && "col-span-2 lg:col-span-1")} />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {stats.map((stat, index) => (
        <Card
          key={stat.key}
          className={cn("border py-0 shadow-2xs ring-0", stat.wash, index === 4 && "col-span-2 lg:col-span-1")}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", stat.iconTint)}>
                <stat.icon className="size-4.5" />
              </span>
              <span className="min-w-0 truncate text-right text-xl font-bold text-foreground tabular-nums sm:text-2xl">
                {stat.value}
              </span>
            </div>
            <p className="mt-2 truncate text-xs font-medium text-foreground/80">{stat.label}</p>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{stat.caption}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
