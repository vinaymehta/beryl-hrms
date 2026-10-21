import { SalaryWorkspace } from "@/features/salary/components/salary-workspace"

export const metadata = { title: "Salary" }

// Active employees with their salary on file, and emailing a chosen set of
// them their slip for a month. Gated by salary.send on both sides.
export default function SalaryPage() {
  return <SalaryWorkspace />
}
