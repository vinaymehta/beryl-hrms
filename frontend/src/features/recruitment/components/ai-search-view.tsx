"use client"

import { useState } from "react"
import { recruitmentApi } from "../api"
import { CandidateDetailModal } from "./candidate-detail-modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { toast } from "sonner"
import {
  SparklesIcon,
  SearchIcon,
  Loader2Icon,
  MapPinIcon,
  BriefcaseIcon,
  GraduationCapIcon,
  LayersIcon,
  StarIcon,
  EyeIcon,
  ArrowRightIcon,
  CheckCircle2Icon,
} from "lucide-react"
import type { AiSearchResponse, CandidateSummary } from "@/types/recruitment"

interface AiSearchViewProps {
  onOpenCandidate?: (candidateId: string) => void
}

export function AiSearchView({ onOpenCandidate }: AiSearchViewProps) {
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AiSearchResponse | null>(null)
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null)

  const sampleQueries = [
    "Full-Stack Engineer with React and Ruby in Bangalore with 3+ years experience",
    "DevOps or Cloud Engineer with AWS, Docker, and Kubernetes",
    "Senior Java Developer with Spring Boot and 5+ years experience",
    "Product or Project Manager with MBA or B.Tech",
  ]

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) {
      toast.error("Please enter a natural language search query")
      return
    }

    setLoading(true)
    try {
      const res = await recruitmentApi.search.ai(searchQuery)
      setResult(res)
      if (res.candidates.length === 0) {
        toast.info("No candidates strictly matched all criteria — showing broadest relevant pool.")
      } else {
        toast.success(`Found ${res.candidates.length} candidate(s)`)
      }
    } catch (err: any) {
      toast.error(err?.message || "AI search failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Search Header / Prompt */}
      <div className="rounded-2xl border bg-gradient-to-b from-role-recruitment/5 to-transparent p-8 sm:p-10 space-y-6">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-role-recruitment text-primary-foreground shadow-lg shadow-role-recruitment/20">
            <SparklesIcon className="size-7" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">
            AI{" "}
            <span className="bg-gradient-to-r from-primary to-role-recruitment bg-clip-text text-transparent">
              Discovery
            </span>
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Describe the candidate you're looking for in plain English — AI Discovery searches your
            entire talent pool instantly.
          </p>
        </div>

        <div className="mx-auto w-full max-w-2xl space-y-3">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. Find senior React engineers in Bangalore with 4+ years experience and AWS..."
              className="h-12 rounded-xl bg-card pl-10 pr-4 text-sm shadow-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {sampleQueries.map((sample, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(sample)
                    handleSearch(sample)
                  }}
                  className="rounded-md border bg-card px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:border-role-recruitment/40 hover:bg-role-recruitment/10 transition-colors text-left"
                >
                  &ldquo;{sample}&rdquo;
                </button>
              ))}
            </div>

            <Button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="gap-1.5 shrink-0 bg-gradient-to-r from-primary to-role-recruitment text-primary-foreground shadow-md shadow-role-recruitment/25 hover:opacity-90"
            >
              {loading ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" />
                  Parsing Query...
                </>
              ) : (
                <>
                  <SparklesIcon className="size-4" />
                  Run AI Discovery
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Structured Criteria Breakdown */}
      {result && (
        <div className="space-y-4 animate-fadeIn">
          <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <CheckCircle2Icon className="size-3.5 text-role-recruitment" />
                Structured Criteria Parsed by AI
              </span>
              <span className="text-[11px] text-muted-foreground">
                Deterministic Database Filter
              </span>
            </div>

            {result.interpretation && (
              <p className="text-xs text-muted-foreground italic">&ldquo;{result.interpretation}&rdquo;</p>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              {result.criteria.city && (
                <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium">
                  <MapPinIcon className="size-3 text-role-recruitment" /> City: {result.criteria.city}
                </span>
              )}

              {result.criteria.minExperience !== undefined && result.criteria.minExperience !== null && (
                <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium">
                  <BriefcaseIcon className="size-3 text-purple-500" /> Min Exp: {result.criteria.minExperience} Yrs
                </span>
              )}

              {result.criteria.jobTitle && (
                <span className="inline-flex items-center gap-1 rounded-md border bg-card px-2.5 py-1 text-xs font-medium">
                  <BriefcaseIcon className="size-3 text-blue-500" /> Role: {result.criteria.jobTitle}
                </span>
              )}

              {result.criteria.skills && result.criteria.skills.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Skills:</span>
                  {result.criteria.skills.map((sk, i) => (
                    <span
                      key={i}
                      className="rounded-md border bg-muted/30 px-2 py-0.5 text-xs font-medium text-foreground"
                    >
                      {sk}
                    </span>
                  ))}
                </div>
              )}

              {result.criteria.qualifications && result.criteria.qualifications.length > 0 && (
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-muted-foreground">Degree:</span>
                  {result.criteria.qualifications.map((q, i) => (
                    <span
                      key={i}
                      className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400"
                    >
                      {q}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Results List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Matching Candidates ({result.candidates.length})
              </h4>
            </div>

            {result.candidates.length === 0 ? (
              <div className="rounded-xl border border-dashed p-8 text-center text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">No matching candidates found in database</p>
                <p>Try widening your search terms or scanning more resumes from your Zoho Mail inbox.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.candidates.map((c) => (
                  <Card
                    key={c.id}
                    onClick={() => setSelectedCandidateId(c.id)}
                    className="cursor-pointer hover:border-role-recruitment/40 transition-colors shadow-2xs"
                  >
                    <CardContent className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{c.fullName}</h4>
                          <p className="text-xs text-muted-foreground font-medium">
                            {c.currentRole || "Candidate"}
                          </p>
                        </div>

                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                          {c.status.replace("_", " ")}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {c.city && (
                          <span className="flex items-center gap-1">
                            <MapPinIcon className="size-3 text-muted-foreground" /> {c.city}
                          </span>
                        )}
                        <span>{c.experienceYears} Years Exp</span>
                        {c.highestQualification && <span>• {c.highestQualification}</span>}
                      </div>

                      {c.skills && c.skills.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {c.skills.slice(0, 4).map((sk, idx) => (
                            <span
                              key={idx}
                              className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-foreground/80"
                            >
                              {sk}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-end pt-2 border-t">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedCandidateId(c.id)
                          }}
                          className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1"
                        >
                          View Profile <ArrowRightIcon className="size-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <CandidateDetailModal
        candidateId={selectedCandidateId}
        open={!!selectedCandidateId}
        onOpenChange={(open) => !open && setSelectedCandidateId(null)}
      />
    </div>
  )
}
