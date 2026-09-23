"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  PlusIcon, Trash2Icon, ArrowLeftIcon, TriangleAlertIcon, CheckCircle2Icon, LayersIcon,
} from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { TemplateImportPanel } from "@/features/appraisals/components/template-import-panel"
import { APPRAISAL_LENSES } from "@/features/appraisals/constants"
import { useAppraisalTemplate } from "@/features/appraisals/hooks/use-appraisals"
import { useCreateAppraisalTemplate } from "@/features/appraisals/hooks/use-appraisal-mutations"
import type { AppraisalLens, AppraisalTemplate, TemplateImportPreview } from "@/types/appraisals"

interface DraftQuestion {
  key: string
  prompt: string
  description: string
  selfRating: boolean
  managerRating: boolean
  requiresComment: boolean
  required: boolean
}

interface DraftCategory {
  key: string
  name: string
  description: string
  /**
   * "" means the source never said which perspective this area belongs to — a
   * sectioned company workbook lists its perspectives separately and maps
   * none of the areas to one. The importer refuses to guess, so the admin
   * picks here, and saving is blocked until they have.
   */
  lens: AppraisalLens | ""
  weight: string
  questions: DraftQuestion[]
}

const newKey = () => Math.random().toString(36).slice(2)

function blankQuestion(): DraftQuestion {
  return { key: newKey(), prompt: "", description: "", selfRating: true, managerRating: true, requiresComment: false, required: true }
}

function blankCategory(): DraftCategory {
  return { key: newKey(), name: "", description: "", lens: "past", weight: "", questions: [blankQuestion()] }
}

function categoriesFrom(template?: AppraisalTemplate): DraftCategory[] {
  if (!template) return [blankCategory()]
  return template.categories.map((category) => ({
    key: newKey(),
    name: category.name,
    description: category.description ?? "",
    lens: category.lens,
    weight: String(Number(category.weight)),
    questions: category.questions.map((question) => ({
      key: newKey(),
      prompt: question.prompt,
      description: question.description ?? "",
      selfRating: question.selfRating,
      managerRating: question.managerRating,
      requiresComment: question.requiresComment,
      required: question.required,
    })),
  }))
}

/**
 * Everything the workbook carried that isn't a category or a question. Kept
 * verbatim and saved on the template — see the `structure` column. Null for a
 * flat one-row-per-question sheet, which has no such sections.
 */
function structureFromImport(preview: TemplateImportPreview): Record<string, unknown> | null {
  if (preview.layout !== "sectioned") return null

  return {
    title: preview.title ?? null,
    assessmentPeriod: preview.assessmentPeriod ?? null,
    employeeFields: preview.employeeFields ?? { fields: [], missing: [] },
    perspectives: preview.perspectives ?? [],
    developmentFields: preview.developmentFields ?? [],
    finalReviewFields: preview.finalReviewFields ?? [],
    ratingGuide: preview.ratingGuide ?? [],
    notes: preview.notes ?? [],
    // The wizard's running order. This is the part the appraisal form reads to
    // decide which steps exist and what each one asks, so a workbook with a
    // renamed, added or removed section changes the form without a code change.
    wizardSections: preview.wizardSections ?? [],
  }
}

/** Parsed spreadsheet → the same draft shape a hand-built template uses. */
function categoriesFromImport(preview: TemplateImportPreview): DraftCategory[] {
  return preview.categories.map((category) => ({
    key: newKey(),
    name: category.name,
    description: category.description ?? "",
    lens: category.lens ?? "",
    weight: String(category.weight),
    questions: category.questions.map((question) => ({
      key: newKey(),
      prompt: question.prompt,
      description: question.description ?? "",
      selfRating: question.selfRating,
      managerRating: question.managerRating,
      requiresComment: question.requiresComment,
      required: question.required,
    })),
  }))
}

/**
 * HR/Admin's template builder (scope §5): categories, questions, descriptions,
 * weights, display order, self-/manager-rating settings and required comments.
 *
 * A PAGE, not a drawer. A template is a long, nested document — seven or more
 * weighted categories each holding several questions — and building one in a
 * side panel meant working through it in a column narrower than the content.
 *
 * Always creates — never edits in place. A template a cycle has started against
 * is frozen (§11), so "duplicate as a new version" is the only safe way to
 * change one, and making that the single path removes the chance of silently
 * rewriting the questions a historical appraisal was answered against.
 *
 * The 100% weight rule (§5) is shown live here and enforced again server-side,
 * so a template can't be activated in a state the engine would reject.
 */
export function TemplateBuilderPage({ sourceId }: { sourceId?: string }) {
  const { data: source, isLoading } = useAppraisalTemplate(sourceId)

  if (sourceId && isLoading) {
    return (
      <div className="grid gap-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    )
  }

  // Keyed so switching source rebuilds the draft state from scratch rather than
  // leaving the previous template's categories sitting in the form.
  return <TemplateBuilderBody key={source?.id ?? "new"} source={source} />
}

function TemplateBuilderBody({ source }: { source?: AppraisalTemplate }) {
  const router = useRouter()
  const [name, setName] = useState(source ? `${source.name}` : "")
  const [description, setDescription] = useState(source?.description ?? "")
  const [categories, setCategories] = useState<DraftCategory[]>(() => categoriesFrom(source))
  const [activateNow, setActivateNow] = useState(true)
  const createTemplate = useCreateAppraisalTemplate()

  /**
   * The parts of an imported workbook the category/question model has no column
   * for — employee fields, the three perspectives, the development prompts, the
   * final review and the rating guide. Held here and saved with the template so
   * the import does not quietly throw away most of the document it just read.
   */
  const [structure, setStructure] = useState<Record<string, unknown> | null>(null)

  const totalWeight = useMemo(
    () => categories.reduce((sum, category) => sum + (Number(category.weight) || 0), 0),
    [categories]
  )
  const weightsOk = Math.abs(totalWeight - 100) < 0.01
  const hasQuestions = categories.every((category) => category.questions.some((q) => q.prompt.trim()))
  const namesOk = Boolean(name.trim()) && categories.every((category) => category.name.trim())
  // An imported workbook can arrive without perspectives assigned; the column
  // is NOT NULL, so saving one would silently store "past".
  const missingLens = categories.filter((category) => category.lens === "")
  // Activation is what triggers the server's completeness checks, so a draft
  // can be saved incomplete but an active template cannot. The Create button
  // used to be disabled outright by this, which left an admin who imported a
  // workbook staring at a dead button with nothing saying why.
  const canSave =
    namesOk && hasQuestions && (!activateNow || (weightsOk && missingLens.length === 0))
  const questionCount = categories.reduce(
    (sum, category) => sum + category.questions.filter((q) => q.prompt.trim()).length,
    0
  )

  function patchCategory(key: string, patch: Partial<DraftCategory>) {
    setCategories((prev) => prev.map((category) => (category.key === key ? { ...category, ...patch } : category)))
  }

  function patchQuestion(categoryKey: string, questionKey: string, patch: Partial<DraftQuestion>) {
    setCategories((prev) =>
      prev.map((category) =>
        category.key === categoryKey
          ? {
              ...category,
              questions: category.questions.map((question) =>
                question.key === questionKey ? { ...question, ...patch } : question
              ),
            }
          : category
      )
    )
  }

  function goBack() {
    router.push("/appraisals?tab=templates")
  }

  function handleSave() {
    createTemplate.mutate(
      {
        name,
        description,
        status: activateNow ? "active" : "draft",
        ...(structure ? { structure } : {}),
        categoriesAttributes: categories.map((category, index) => ({
          name: category.name,
          description: category.description,
          lens: category.lens || null,
          weight: Number(category.weight) || 0,
          position: index,
          questionsAttributes: category.questions
            .filter((question) => question.prompt.trim())
            .map((question, questionIndex) => ({
              prompt: question.prompt,
              description: question.description,
              position: questionIndex,
              selfRating: question.selfRating,
              managerRating: question.managerRating,
              requiresComment: question.requiresComment,
              required: question.required,
            })),
        })),
      },
      { onSuccess: goBack }
    )
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Button variant="ghost" size="icon" aria-label="Back to templates" onClick={goBack}>
            <ArrowLeftIcon className="size-4" />
          </Button>
          <span className="flex size-9 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
            <LayersIcon className="size-4.5" />
          </span>
          <div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight">
              {source ? `New version of ${source.name}` : "New appraisal template"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {source
                ? "The original stays exactly as it is, so historical appraisals are untouched."
                : "Weighted categories and the questions inside them. Weights must total 100%."}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
        <div className="grid gap-4">
          {/* Offered on a new template only: a new VERSION starts from the
              questions it is versioning, and silently replacing those with a
              spreadsheet would defeat the point of versioning from the source. */}
          {!source && (
            <TemplateImportPanel
              onUse={(preview) => {
                const imported = categoriesFromImport(preview)
                setCategories(imported)
                setStructure(structureFromImport(preview))
                // An imported workbook usually arrives with no perspectives
                // assigned, and a template missing those cannot be activated.
                // Leaving "activate now" ticked would just disable Create with
                // no obvious cause, so it drops to draft and the admin ticks it
                // back once the perspectives are set.
                if (imported.some((category) => category.lens === "")) setActivateNow(false)
              }}
            />
          )}

          <section className="grid gap-3.5 rounded-xl border bg-card p-4 shadow-2xs">
            <div className="grid gap-1.5">
              <Label htmlFor="template-name">Template name</Label>
              <Input
                id="template-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="2026 Performance Review"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="template-description">Description</Label>
              <Input
                id="template-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </section>

          {categories.map((category, index) => (
            <section key={category.key} className="overflow-hidden rounded-xl border bg-card shadow-2xs">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <span className="flex size-6 items-center justify-center rounded-full border text-[11px] text-muted-foreground">
                    {index + 1}
                  </span>
                  Category
                </span>
                {categories.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove category"
                    onClick={() => setCategories((prev) => prev.filter((c) => c.key !== category.key))}
                  >
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3.5 p-4">
                <div className="grid gap-3.5 sm:grid-cols-[2fr_1fr_auto]">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`cat-name-${category.key}`}>Name</Label>
                    <Input
                      id={`cat-name-${category.key}`}
                      value={category.name}
                      onChange={(e) => patchCategory(category.key, { name: e.target.value })}
                      placeholder="Technical Skills & Code Quality"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`cat-lens-${category.key}`}>Lens</Label>
                    <Select
                      items={APPRAISAL_LENSES.map((l) => ({ value: l.value, label: l.label }))}
                      value={category.lens}
                      onValueChange={(next) => patchCategory(category.key, { lens: (next as AppraisalLens) ?? "" })}
                    >
                      <SelectTrigger id={`cat-lens-${category.key}`} className="h-9 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPRAISAL_LENSES.map((lens) => (
                          <SelectItem key={lens.value} value={lens.value}>
                            {lens.label} ({lens.targetWeight}%)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid w-24 gap-1.5">
                    <Label htmlFor={`cat-weight-${category.key}`}>Weight %</Label>
                    <Input
                      id={`cat-weight-${category.key}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={category.weight}
                      onChange={(e) => patchCategory(category.key, { weight: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid gap-2 border-t pt-3">
                  <p className="text-xs font-semibold text-muted-foreground">Questions</p>
                  {category.questions.map((question) => (
                    <div key={question.key} className="grid gap-2 rounded-lg border p-2.5">
                      <div className="flex items-start gap-2">
                        <Input
                          value={question.prompt}
                          aria-label="Question"
                          onChange={(e) => patchQuestion(category.key, question.key, { prompt: e.target.value })}
                          placeholder="What is being assessed?"
                        />
                        {category.questions.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Remove question"
                            onClick={() =>
                              patchCategory(category.key, {
                                questions: category.questions.filter((q) => q.key !== question.key),
                              })
                            }
                          >
                            <Trash2Icon className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                        {([
                          ["selfRating", "Employee rates"],
                          ["managerRating", "Manager rates"],
                          ["requiresComment", "Evidence required"],
                          ["required", "Required"],
                        ] as const).map(([key, label]) => (
                          <Label key={key} className="flex items-center gap-1.5 text-xs font-normal">
                            <Checkbox
                              checked={question[key]}
                              onCheckedChange={(next) =>
                                patchQuestion(category.key, question.key, { [key]: Boolean(next) })
                              }
                            />
                            {label}
                          </Label>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit gap-1.5"
                    onClick={() =>
                      patchCategory(category.key, { questions: [...category.questions, blankQuestion()] })
                    }
                  >
                    <PlusIcon className="size-3.5" /> Add question
                  </Button>
                </div>
              </div>
            </section>
          ))}

          <Button
            variant="outline"
            className="w-fit gap-1.5"
            onClick={() => setCategories((prev) => [...prev, blankCategory()])}
          >
            <PlusIcon className="size-4" /> Add category
          </Button>

          {/* The rest of the imported workbook. The categories above are only
              part of it, and without this an admin sees seven questions load
              and reasonably concludes the other sections were dropped. They
              are not edited here — they are saved with the template exactly as
              the spreadsheet defined them. */}
          {structure && (
            <section className="grid gap-2 rounded-xl border bg-card p-4 shadow-2xs">
              <div>
                <h3 className="text-sm font-semibold">Also imported from the workbook</h3>
                <p className="text-xs text-muted-foreground">
                  Saved with this template and rendered by the appraisal form. Change them in the
                  spreadsheet and import again.
                </p>
              </div>
              <ul className="grid gap-1.5 sm:grid-cols-2">
                {[
                  [ "Performance perspectives", (structure.perspectives as unknown[])?.length ],
                  [ "Development & career prompts", (structure.developmentFields as unknown[])?.length ],
                  [ "Final review fields", (structure.finalReviewFields as unknown[])?.length ],
                  [ "Rating guide entries", (structure.ratingGuide as unknown[])?.length ],
                  [ "Employee information fields",
                    ((structure.employeeFields as { fields?: unknown[] })?.fields)?.length ],
                  [ "Wizard steps", (structure.wizardSections as unknown[])?.length ],
                ].map(([label, count]) => (
                  <li
                    key={String(label)}
                    className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs"
                  >
                    <span>{String(label)}</span>
                    <Badge variant="outline" className="tabular-nums">
                      {Number(count ?? 0)}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* The weight total has to stay in view while categories are being
            edited — it is the one rule that decides whether this can be
            activated at all. */}
        <aside className="grid gap-3 xl:sticky xl:top-4">
          {missingLens.length > 0 && (
            <div className="grid gap-1 rounded-xl border border-info/40 bg-info/5 p-4">
              <p className="text-sm font-medium text-info">
                {missingLens.length} categor{missingLens.length === 1 ? "y needs" : "ies need"} a perspective
              </p>
              <p className="text-xs text-muted-foreground">
                This workbook lists its perspectives separately and doesn&apos;t say which area belongs to
                which, so nothing was assumed. You can save this as a draft now; activating it needs all of
                them set.
              </p>
            </div>
          )}
          <div
            className={cn(
              "grid gap-1.5 rounded-xl border p-4",
              weightsOk ? "border-success/40 bg-success/5" : "border-warning/40 bg-warning/5"
            )}
          >
            <p
              className={cn(
                "flex items-center gap-2 text-sm font-medium tabular-nums",
                weightsOk ? "text-success" : "text-warning"
              )}
            >
              {weightsOk ? <CheckCircle2Icon className="size-4" /> : <TriangleAlertIcon className="size-4" />}
              Weights total {totalWeight.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {weightsOk ? "Ready to activate." : "Must total exactly 100% before this can be activated."}
            </p>
            <p className="text-xs text-muted-foreground">
              {categories.length} categor{categories.length === 1 ? "y" : "ies"} · {questionCount} question
              {questionCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid gap-3 rounded-xl border bg-card p-4">
            <Label className="flex items-start gap-2 text-sm font-normal">
              <Checkbox
                checked={activateNow}
                disabled={missingLens.length > 0}
                onCheckedChange={(next) => setActivateNow(Boolean(next))}
              />
              <span>
                Activate now
                <span className="block text-xs text-muted-foreground">
                  Only active templates can be used by a cycle.
                </span>
              </span>
            </Label>
            <Button
              className="bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
              disabled={!canSave || createTemplate.isPending}
              onClick={handleSave}
            >
              {createTemplate.isPending ? "Saving…" : source ? "Create new version" : "Create template"}
            </Button>
            <Button variant="outline" onClick={goBack}>
              Cancel
            </Button>
          </div>
        </aside>
      </div>
    </div>
  )
}
