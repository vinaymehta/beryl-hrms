"use client"

import { use } from "react"
import { useRouter } from "next/navigation"

import { AppraisalDetail } from "@/features/appraisals/components/appraisal-detail"

/**
 * Standalone route for one appraisal — what a notification's action_url points
 * at, so a link from the bell lands directly on the thing that needs doing.
 */
export default function AppraisalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  return <AppraisalDetail appraisalId={id} onBack={() => router.push("/appraisals")} />
}
