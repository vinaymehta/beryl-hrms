"use client"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { CandidateProfileContent } from "./candidate-profile-content"
import { useCandidate } from "../hooks"

interface CandidateDetailModalProps {
  candidateId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Quick-look modal over the shared candidate profile content — see
// /recruitment/candidates/[id]/page.tsx for the same content as a
// bookmarkable, deep-linkable full page.
export function CandidateDetailModal({ candidateId, open, onOpenChange }: CandidateDetailModalProps) {
  // Shares the query-cache entry CandidateProfileContent itself reads — this
  // is not a second network round trip, just an accessible dialog title.
  const { data: candidate } = useCandidate(candidateId || "")

  if (!candidateId) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        <DialogTitle className="sr-only">{candidate?.fullName || "Candidate profile"}</DialogTitle>
        <CandidateProfileContent candidateId={candidateId} />
      </DialogContent>
    </Dialog>
  )
}
