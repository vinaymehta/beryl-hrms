"use client"

import { use } from "react"

import { EmployeeDetailContent } from "@/features/employees/components/employee-detail-content"

export default function EmployeeProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  return <EmployeeDetailContent employeeId={id} />
}
