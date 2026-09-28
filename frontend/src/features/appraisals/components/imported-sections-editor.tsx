"use client"

import { useState } from "react"
import { ChevronDownIcon, PlusIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  TemplateImportLabelledField,
  TemplateImportPerspective,
  TemplateImportRatingGuideRow,
  TemplateStructure,
  TemplateWizardSection,
} from "@/types/appraisals"

/**
 * The same key TemplateImport.field_key derives from a label. Answers are filed
 * against it, and DetailPresenter/the appraisal form rebuild it from the name,
 * so the two must agree exactly.
 */
function fieldKey(label: string) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "field"
}

/**
 * Rebuilds the wizard steps from the edited lists, in the importer's order:
 * perspectives (manager), development (employee), final review (manager).
 *
 * Titles and captions the admin set are kept; a section whose list is emptied
 * is dropped, and one that gains its first row is added with a default title —
 * the same rules TemplateImport#wizard_sections applies to a fresh import.
 */
export function withDerivedSections(structure: TemplateStructure): TemplateStructure {
  const existing = new Map((structure.wizardSections ?? []).map((section) => [section.key, section]))
  const sections: TemplateWizardSection[] = []

  const perspectives = (structure.perspectives ?? []).filter((row) => row.name.trim())
  if (perspectives.length) {
    const prior = existing.get("perspectives")
    sections.push({
      key: "perspectives",
      kind: "perspectives",
      title: prior?.title || "Performance perspective",
      caption: prior?.caption ?? "Completed by the reviewer",
      audience: "reviewer",
      fields: perspectives.map((row) => ({
        key: fieldKey(row.name),
        label: row.name,
        description: row.assessmentFocus,
        weight: row.weight,
      })),
    })
  }

  const longText = (
    key: "development" | "final_review",
    rows: TemplateImportLabelledField[] | undefined,
    defaults: { title: string; caption: string; audience?: "reviewer" }
  ) => {
    const filled = (rows ?? []).filter((row) => row.label.trim())
    if (!filled.length) return
    const prior = existing.get(key)
    sections.push({
      key,
      kind: "long_text",
      title: prior?.title || defaults.title,
      caption: prior?.caption ?? defaults.caption,
      ...(defaults.audience ? { audience: defaults.audience } : {}),
      fields: filled.map((row) => ({
        key: fieldKey(row.label),
        label: row.label,
        input: "textarea",
        // The Final Review block is answered field by field: the employee's
        // own final comments by them, the rest by every manager level.
        ...(key === "final_review"
          ? { audience: /\bemployee\b/i.test(row.label) ? ("employee" as const) : ("reviewer" as const) }
          : {}),
      })),
    })
  }
  longText("development", structure.developmentFields, {
    title: "Development & career discussion",
    caption: "In your own words",
  })
  longText("final_review", structure.finalReviewFields, {
    title: "Final review",
    caption: "Final comments and recommendation",
  })

  return { ...structure, wizardSections: sections }
}

/**
 * Everything the workbook carried besides the performance areas, editable.
 *
 * Each list is edited in place — rename, add, remove — and the appraisal
 * form's steps are rebuilt from the result, so what is saved here is exactly
 * what employees and reviewers are asked.
 */
export function ImportedSectionsEditor({
  structure,
  onChange,
}: {
  structure: TemplateStructure
  onChange: (next: TemplateStructure) => void
}) {
  const update = (patch: Partial<TemplateStructure>) => onChange(withDerivedSections({ ...structure, ...patch }))
  const steps = structure.wizardSections ?? []

  const perspectives = structure.perspectives ?? []
  const development = structure.developmentFields ?? []
  const finalReview = structure.finalReviewFields ?? []
  const guide = structure.ratingGuide ?? []
  const employeeFields = structure.employeeFields?.fields ?? []

  function patchStep(key: string, patch: Partial<TemplateWizardSection>) {
    onChange({ ...structure, wizardSections: steps.map((s) => (s.key === key ? { ...s, ...patch } : s)) })
  }

  return (
    <>
      <EditableSection
        label="Performance perspectives"
        hint="Rated by the manager, with a summary, for each perspective."
        count={perspectives.length}
        onAdd={() =>
          update({
            perspectives: [
              ...perspectives,
              { name: "", lens: null, weight: null, assessmentFocus: "", managerRating: null, managerSummary: null },
            ],
          })
        }
      >
        {perspectives.map((row, index) => {
          const set = (patch: Partial<TemplateImportPerspective>) =>
            update({ perspectives: perspectives.map((p, i) => (i === index ? { ...p, ...patch } : p)) })
          return (
            <Row key={index} onRemove={() => update({ perspectives: perspectives.filter((_, i) => i !== index) })}>
              <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_6rem]">
                <Input
                  aria-label="Perspective name"
                  value={row.name}
                  onChange={(e) => set({ name: e.target.value })}
                  placeholder="Past Performance"
                />
                <Input
                  aria-label="Perspective weight %"
                  type="number"
                  min="0"
                  max="100"
                  value={row.weight ?? ""}
                  onChange={(e) => set({ weight: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder="Weight %"
                />
              </div>
              <Input
                aria-label="Assessment focus"
                value={row.assessmentFocus ?? ""}
                onChange={(e) => set({ assessmentFocus: e.target.value })}
                placeholder="Assessment focus"
              />
            </Row>
          )
        })}
      </EditableSection>

      <LabelList
        label="Development & career prompts"
        hint="Answered by the employee."
        rows={development}
        placeholder="Key achievements this year"
        onChange={(rows) => update({ developmentFields: rows })}
      />

      <LabelList
        label="Final review fields"
        hint="A field naming the employee is theirs; the rest every manager answers. Admin/HR see all of them at Discussion."
        rows={finalReview}
        placeholder="Overall manager comments"
        onChange={(rows) => update({ finalReviewFields: rows })}
      />

      <EditableSection
        label="Rating guide entries"
        hint="The scale every rating in the appraisal uses — ratings 1 to 5."
        count={guide.length}
        onAdd={() => update({ ratingGuide: [...guide, { rating: guide.length + 1, level: "", definition: "" }] })}
      >
        {guide.map((row, index) => {
          const set = (patch: Partial<TemplateImportRatingGuideRow>) =>
            update({ ratingGuide: guide.map((g, i) => (i === index ? { ...g, ...patch } : g)) })
          return (
            <Row key={index} onRemove={() => update({ ratingGuide: guide.filter((_, i) => i !== index) })}>
              <div className="grid gap-1.5 sm:grid-cols-[4.5rem_minmax(0,1fr)]">
                <Input
                  aria-label="Rating"
                  type="number"
                  min="1"
                  max="5"
                  value={row.rating ?? ""}
                  onChange={(e) => set({ rating: e.target.value === "" ? null : Number(e.target.value) })}
                  placeholder="1"
                />
                <Input
                  aria-label="Level"
                  value={row.level ?? ""}
                  onChange={(e) => set({ level: e.target.value })}
                  placeholder="Exceeds expectations"
                />
              </div>
              <Input
                aria-label="Definition"
                value={row.definition ?? ""}
                onChange={(e) => set({ definition: e.target.value })}
                placeholder="What this rating means"
              />
            </Row>
          )
        })}
      </EditableSection>

      <LabelList
        label="Employee information fields"
        hint="Filled in per employee."
        rows={employeeFields}
        placeholder="Employee Name"
        onChange={(rows) =>
          update({ employeeFields: { fields: rows, missing: structure.employeeFields?.missing ?? [] } })
        }
      />

      {steps.length > 0 && (
        <EditableSection label="Appraisal form steps" hint="What each step is called in the appraisal." count={steps.length}>
          {steps.map((step) => (
            <li key={step.key} className="grid gap-1.5 rounded-lg border bg-background p-2">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`${step.title} step title`}
                  value={step.title}
                  onChange={(e) => patchStep(step.key, { title: e.target.value })}
                />
                <Badge variant="outline" className="shrink-0">
                  {step.audience === "reviewer" ? "Manager" : "Employee"}
                </Badge>
              </div>
              <Input
                aria-label={`${step.title} step caption`}
                value={step.caption ?? ""}
                onChange={(e) => patchStep(step.key, { caption: e.target.value })}
                placeholder="Caption"
              />
            </li>
          ))}
        </EditableSection>
      )}
    </>
  )
}

/** A list of plain labelled prompts: one text box per row. */
function LabelList({
  label,
  hint,
  rows,
  placeholder,
  onChange,
}: {
  label: string
  hint: string
  rows: TemplateImportLabelledField[]
  placeholder: string
  onChange: (rows: TemplateImportLabelledField[]) => void
}) {
  return (
    <EditableSection
      label={label}
      hint={hint}
      count={rows.length}
      onAdd={() => onChange([...rows, { label: "", value: null }])}
    >
      {rows.map((row, index) => (
        <Row key={index} onRemove={() => onChange(rows.filter((_, i) => i !== index))}>
          <Input
            aria-label={`${label} ${index + 1}`}
            value={row.label}
            onChange={(e) => onChange(rows.map((r, i) => (i === index ? { ...r, label: e.target.value } : r)))}
            placeholder={placeholder}
          />
        </Row>
      ))}
    </EditableSection>
  )
}

function EditableSection({
  label,
  hint,
  count,
  onAdd,
  children,
}: {
  label: string
  hint: string
  count: number
  onAdd?: () => void
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  // Its own card, laid out exactly like a category card in the builder.
  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-2xs">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold",
          open && "border-b"
        )}
      >
        <ChevronDownIcon
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
        />
        <span className="truncate">{label}</span>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {count}
        </Badge>
        <span className="ml-auto hidden truncate text-xs font-normal text-muted-foreground sm:inline">{hint}</span>
      </button>

      {open && (
        <div className="grid gap-3 p-4">
          <ul className="grid gap-2">{children}</ul>
          {onAdd && (
            <Button type="button" variant="outline" size="sm" className="w-fit gap-1.5" onClick={onAdd}>
              <PlusIcon className="size-3.5" /> Add
            </Button>
          )}
        </div>
      )}
    </section>
  )
}

function Row({ onRemove, children }: { onRemove: () => void; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 rounded-lg border bg-background p-2">
      <div className="grid min-w-0 flex-1 gap-1.5">{children}</div>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Remove"
        className="shrink-0 text-muted-foreground hover:text-destructive"
        onClick={onRemove}
      >
        <Trash2Icon className="size-3.5" />
      </Button>
    </li>
  )
}
