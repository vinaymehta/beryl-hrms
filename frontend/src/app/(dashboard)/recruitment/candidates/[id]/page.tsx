"use client"

import { use } from "react"
import { Card } from "@/components/ui/card"
import { CandidateProfileContent } from "@/features/recruitment/components/candidate-profile-content"

export default function CandidateProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  return (
    <Card className="overflow-hidden p-0 gap-0">
      <CandidateProfileContent candidateId={id} />
    </Card>
  )
}
