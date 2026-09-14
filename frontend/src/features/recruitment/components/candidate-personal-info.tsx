"use client"

import { useState } from "react"
import { useCandidate, useCandidateMutations } from "../hooks"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  PencilIcon,
  Loader2Icon,
  SaveIcon,
  XIcon,
  SparklesIcon,
  UserIcon,
  MapPinIcon,
  BriefcaseIcon,
  GraduationCapIcon,
} from "lucide-react"
import type { CandidateDetail } from "@/types/recruitment"
import { cn } from "cn"

// Everything the AI pulls off a resume that describes the PERSON, grouped the
// way someone reads a CV. `editable: false` marks values that are deterministic
// eligibility facts rather than profile data — see the note on ACADEMIC below.
type FieldKey = keyof Pick<
  CandidateDetail,
  | "fullName"
  | "email"
  | "phone"
  | "city"
  | "state"
  | "country"
  | "currentLocation"
  | "preferredLocation"
  | "currentRole"
  | "highestQualification"
  | "experienceYears"
  | "noticePeriod"
  | "industry"
>

const SECTIONS: { title: string; icon: typeof UserIcon; fields: { key: FieldKey; label: string; type?: string }[] }[] = [
  {
    title: "Contact",
    icon: UserIcon,
    fields: [
      { key: "fullName", label: "Full name" },
      { key: "email", label: "Email", type: "email" },
      { key: "phone", label: "Phone", type: "tel" },
    ],
  },
  {
    title: "Location",
    icon: MapPinIcon,
    fields: [
      { key: "city", label: "City" },
      { key: "state", label: "State" },
      { key: "country", label: "Country" },
      { key: "currentLocation", label: "Current location" },
      { key: "preferredLocation", label: "Preferred location" },
    ],
  },
  {
    title: "Professional",
    icon: BriefcaseIcon,
    fields: [
      { key: "currentRole", label: "Current role" },
      { key: "highestQualification", label: "Highest qualification" },
      { key: "experienceYears", label: "Experience (years)", type: "number" },
      { key: "noticePeriod", label: "Notice period" },
      { key: "industry", label: "Industry" },
    ],
  },
]

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  const empty = value === null || value === undefined || value === ""
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-1.5 last:border-0">
      <span className="shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("text-right text-xs", empty ? "italic text-muted-foreground/60" : "text-foreground")}>
        {empty ? "Not found on resume" : value}
      </span>
    </div>
  )
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof UserIcon
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" />
        {title}
      </p>
      <div className="rounded-lg border p-3">{children}</div>
    </div>
  )
}

/**
 * The personal profile the AI extracted, and the one place it can be corrected.
 * That editing matters: extraction can't always recover a value (a PDF whose
 * font mangles its own contact line yields no email at all), and without a way
 * to supply it by hand the candidate is stuck — no interview invitation and no
 * feedback form can ever reach them.
 */
export function CandidatePersonalInfo({ candidateId, canManage }: { candidateId: string; canManage: boolean }) {
  const { data: candidate, isLoading } = useCandidate(candidateId)
  const { updateCandidate } = useCandidateMutations()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({})

  if (isLoading || !candidate) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }

  const startEditing = () => {
    setDraft(
      Object.fromEntries(
        SECTIONS.flatMap((s) => s.fields).map((f) => [f.key, candidate[f.key] == null ? "" : String(candidate[f.key])])
      ) as Partial<Record<FieldKey, string>>
    )
    setEditing(true)
  }

  const handleSave = async () => {
    // Send only what actually changed, so an untouched field can never be
    // overwritten with a stale value read at the moment editing started.
    const changed: Record<string, unknown> = {}
    for (const f of SECTIONS.flatMap((s) => s.fields)) {
      const next = (draft[f.key] ?? "").trim()
      const current = candidate[f.key] == null ? "" : String(candidate[f.key])
      if (next === current) continue
      changed[f.key] = f.type === "number" ? (next === "" ? 0 : Number(next)) : next === "" ? null : next
    }

    if (Object.keys(changed).length === 0) {
      setEditing(false)
      return
    }

    try {
      await updateCandidate.mutateAsync({ id: candidateId, ...changed })
      toast.success("Candidate details updated")
      setEditing(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the candidate's details")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <SparklesIcon className="size-3.5 text-role-recruitment" />
          Extracted from this candidate&apos;s resume by AI
        </p>
        {canManage &&
          (editing ? (
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditing(false)}
                disabled={updateCandidate.isPending}
                className="h-7 gap-1 text-xs text-muted-foreground"
              >
                <XIcon className="size-3.5" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateCandidate.isPending} className="h-7 gap-1 text-xs">
                {updateCandidate.isPending ? (
                  <Loader2Icon className="size-3.5 animate-spin" />
                ) : (
                  <SaveIcon className="size-3.5" />
                )}
                Save
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" onClick={startEditing} className="h-7 gap-1 text-xs">
              <PencilIcon className="size-3.5" />
              Edit
            </Button>
          ))}
      </div>

      {SECTIONS.map((section) => (
        <SectionCard key={section.title} title={section.title} icon={section.icon}>
          {editing ? (
            <div className="space-y-2">
              {section.fields.map((f) => (
                <div key={f.key} className="flex items-center justify-between gap-3">
                  <label htmlFor={`pi-${f.key}`} className="shrink-0 text-[11px] text-muted-foreground">
                    {f.label}
                  </label>
                  <Input
                    id={`pi-${f.key}`}
                    type={f.type ?? "text"}
                    value={draft[f.key] ?? ""}
                    onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
                    className="h-7 max-w-56 text-xs"
                  />
                </div>
              ))}
            </div>
          ) : (
            section.fields.map((f) => (
              <Row
                key={f.key}
                label={f.label}
                value={f.key === "experienceYears" ? (candidate.experienceYears || null) : candidate[f.key]}
              />
            ))
          )}
        </SectionCard>
      ))}

      {candidate.languages && candidate.languages.length > 0 && (
        <SectionCard title="Languages" icon={UserIcon}>
          <div className="flex flex-wrap gap-1.5">
            {candidate.languages.map((l) => (
              <span key={l} className="rounded-md border bg-muted px-2 py-0.5 text-[11px] text-foreground">
                {l}
              </span>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Read-only on purpose: these four are the deterministic inputs to
          Recruitment::EligibilityEvaluator, which decides shortlisting. Making
          them hand-editable would let someone type their way past the criteria
          without the resume ever supporting it — they change only by
          reprocessing the resume. */}
      <SectionCard title="Academic (drives eligibility)" icon={GraduationCapIcon}>
        <Row label="Marks" value={candidate.academicPercentage != null ? `${candidate.academicPercentage}%` : null} />
        <Row label="CGPA" value={candidate.academicCgpa} />
        <Row label="Graduation year" value={candidate.graduationYear} />
        <Row
          label="Active backlogs"
          value={candidate.activeBacklogs == null ? null : candidate.activeBacklogs ? "Yes" : "No"}
        />
        <p className="pt-2 text-[10px] text-muted-foreground">
          Read-only — these decide automatic shortlisting and only change when the resume is reprocessed.
        </p>
      </SectionCard>
    </div>
  )
}
