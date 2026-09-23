"use client"

import { use } from "react"
import { useRouter } from "next/navigation"

import { AppraisalDetail } from "@/features/appraisals/components/appraisal-detail"

/**
 * One appraisal, as a real route.
 *
 * It used to open inline from the list, which meant the address bar still said
 * /appraisals — so a refresh dropped you back on the list, and the ?tab= the
 * workspace writes had nothing to reload into. A route makes refresh and the
 * browser's Back button behave the way the rest of the app does.
 *
 * Authorization is unchanged and still the server's: AppraisalPolicy::Scope
 * decides whether this id resolves at all, so a guessed one 404s.
 */
export default function AppraisalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  return <AppraisalDetail appraisalId={id} onBack={() => router.push("/appraisals")} />
}
