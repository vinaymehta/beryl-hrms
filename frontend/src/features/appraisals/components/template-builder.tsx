"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  PlusIcon,
  Trash2Icon,
  ArrowLeftIcon,
  TriangleAlertIcon,
  CheckCircle2Icon,
  LayersIcon,
  ChevronDownIcon,
} from "lucide-react"
import { cn } from "cn"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import { TemplateImportPanel } from "@/features/appraisals/components/template-import-panel"
import {
  ImportedSectionsEditor,
  withDerivedSections,
} from "@/features/appraisals/components/imported-sections-editor"
import { useAppraisalTemplate } from "@/features/appraisals/hooks/use-appraisals"
import {
  useCreateAppraisalTemplate,
  useUpdateAppraisalTemplate,
} from "@/features/appraisals/hooks/use-appraisal-mutations"
import type {
  AppraisalTemplate,
  TemplateImportPreview,
  TemplateStructure,
} from "@/types/appraisals"

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
  weight: string
  questions: DraftQuestion[]
}

const newKey = () => Math.random().toString(36).slice(2)

function blankQuestion(): DraftQuestion {
  return {
    key: newKey(),
    prompt: "",
    description: "",
    selfRating: true,
    managerRating: true,
    requiresComment: false,
    required: true,
  }
}

function blankCategory(): DraftCategory {
  return { key: newKey(), name: "", description: "", weight: "", questions: [blankQuestion()] }
}

function categoriesFrom(template?: AppraisalTemplate): DraftCategory[] {
  if (!template) return [blankCategory()]
  return template.categories.map((category) => ({
    key: newKey(),
    name: category.name,
    description: category.description ?? "",
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
function structureFromImport(preview: TemplateImportPreview): TemplateStructure | null {
  // Keyed off whether sections were actually FOUND, not off the layout label.
  // Gating on `layout === "sectioned"` meant one unrecognised heading threw
  // away every section that had been read successfully.
  const hasSections =
    (preview.perspectives?.length ?? 0) > 0 ||
    (preview.developmentFields?.length ?? 0) > 0 ||
    (preview.finalReviewFields?.length ?? 0) > 0 ||
    (preview.ratingGuide?.length ?? 0) > 0
  if (!hasSections) return null

  return withDerivedSections({
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
  })
}

/** Parsed spreadsheet → the same draft shape a hand-built template uses. */
function categoriesFromImport(preview: TemplateImportPreview): DraftCategory[] {
  return preview.categories.map((category) => ({
    key: newKey(),
    name: category.name,
    description: category.description ?? "",
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
/**
 * @param sourceId  open pre-filled as the NEXT VERSION of this template — the
 *   original is untouched and a new row is created.
 * @param editId    open THIS template for editing in place. Only ever a draft:
 *   an active template may have appraisals written against its questions, so
 *   changing it is a new version, not an edit. The server enforces the same.
 */
export function TemplateBuilderPage({ sourceId, editId }: { sourceId?: string; editId?: string }) {
  const { data: source, isLoading } = useAppraisalTemplate(editId ?? sourceId)

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
  return <TemplateBuilderBody key={source?.id ?? "new"} source={source} editing={Boolean(editId)} />
}

function TemplateBuilderBody({
  source,
  editing,
}: {
  source?: AppraisalTemplate
  editing?: boolean
}) {
  const router = useRouter()
  const [name, setName] = useState(source ? `${source.name}` : "")
  const [description, setDescription] = useState(source?.description ?? "")
  const [categories, setCategories] = useState<DraftCategory[]>(() => categoriesFrom(source))
  // Which categories are expanded. Collapsed rows keep a long template
  // scannable, like the imported sections below; a brand-new template's first
  // (blank) category starts open, since it has to be filled in.
  const [openKeys, setOpenKeys] = useState<Set<string>>(() =>
    source ? new Set() : new Set(categories.map((category) => category.key))
  )
  function toggleCategory(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  const [activateNow, setActivateNow] = useState(true)
  const createTemplate = useCreateAppraisalTemplate()
  const updateTemplate = useUpdateAppraisalTemplate(source?.id ?? "")

  /**
   * The parts of an imported workbook the category/question model has no column
   * for — employee fields, the three perspectives, the development prompts, the
   * final review and the rating guide. Held here and saved with the template so
   * the import does not quietly throw away most of the document it just read.
   */
  // Starts from the source's own sections when editing or versioning one, so
  // they stay editable rather than only arriving fresh from an import.
  const [structure, setStructure] = useState<TemplateStructure | null>(
    () => source?.structure ?? null
  )

  const totalWeight = useMemo(
    () => categories.reduce((sum, category) => sum + (Number(category.weight) || 0), 0),
    [categories]
  )
  const weightsOk = Math.abs(totalWeight - 100) < 0.01
  const hasQuestions = categories.every((category) =>
    category.questions.some((q) => q.prompt.trim())
  )
  const namesOk = Boolean(name.trim()) && categories.every((category) => category.name.trim())
  // Activation is what triggers the server's completeness checks, so a draft
  // can be saved incomplete but an active template cannot. The Create button
  // used to be disabled outright by this, which left an admin who imported a
  // workbook staring at a dead button with nothing saying why.
  const canSave = namesOk && hasQuestions && (!activateNow || weightsOk)
  const questionCount = categories.reduce(
    (sum, category) => sum + category.questions.filter((q) => q.prompt.trim()).length,
    0
  )

  function patchCategory(key: string, patch: Partial<DraftCategory>) {
    setCategories((prev) =>
      prev.map((category) => (category.key === key ? { ...category, ...patch } : category))
    )
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
    const payload = {
      name,
      description,
      status: activateNow ? "active" : "draft",
      ...(structure ? { structure } : {}),
      categoriesAttributes: categories.map((category, index) => ({
        name: category.name,
        description: category.description,
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
    }

    // Editing replaces the template in place; anything else creates a new one.
    // Both go to the same list afterwards.
    if (editing && source) updateTemplate.mutate(payload, { onSuccess: goBack })
    else createTemplate.mutate(payload, { onSuccess: goBack })
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
              {editing && source
                ? `Edit ${source.name}`
                : source
                  ? `New version of ${source.name}`
                  : "New appraisal template"}
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
                setOpenKeys(new Set())
                setStructure(structureFromImport(preview))
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
            <section
              key={category.key}
              className="overflow-hidden rounded-xl border bg-card shadow-2xs"
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-2 px-4 py-2.5",
                  openKeys.has(category.key) && "border-b"
                )}
              >
                <button
                  type="button"
                  aria-expanded={openKeys.has(category.key)}
                  onClick={() => toggleCategory(category.key)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm font-semibold"
                >
                  <ChevronDownIcon
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      openKeys.has(category.key) && "rotate-180"
                    )}
                  />
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <span className="truncate">{category.name.trim() || "Untitled category"}</span>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {Number(category.weight) || 0}%
                  </Badge>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    {category.questions.filter((q) => q.prompt.trim()).length} question
                    {category.questions.filter((q) => q.prompt.trim()).length === 1 ? "" : "s"}
                  </Badge>
                </button>
                {categories.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove category"
                    onClick={() =>
                      setCategories((prev) => prev.filter((c) => c.key !== category.key))
                    }
                  >
                    <Trash2Icon className="size-4 text-destructive" />
                  </Button>
                )}
              </div>

              {openKeys.has(category.key) && (
                <div className="grid gap-3.5 p-4">
                  <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`cat-name-${category.key}`}>Name</Label>
                      <Input
                        id={`cat-name-${category.key}`}
                        value={category.name}
                        onChange={(e) => patchCategory(category.key, { name: e.target.value })}
                        placeholder="Technical Skills & Code Quality"
                      />
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
                            onChange={(e) =>
                              patchQuestion(category.key, question.key, { prompt: e.target.value })
                            }
                            placeholder="What is being assessed?"
                          />
                          {category.questions.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Remove question"
                              onClick={() =>
                                patchCategory(category.key, {
                                  questions: category.questions.filter(
                                    (q) => q.key !== question.key
                                  ),
                                })
                              }
                            >
                              <Trash2Icon className="size-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                          {(
                            [
                              ["selfRating", "Employee rates"],
                              ["managerRating", "Manager rates"],
                              ["requiresComment", "Evidence required"],
                              ["required", "Required"],
                            ] as const
                          ).map(([key, label]) => (
                            <Label
                              key={key}
                              className="flex items-center gap-1.5 text-xs font-normal"
                            >
                              <Checkbox
                                checked={question[key]}
                                onCheckedChange={(next) =>
                                  patchQuestion(category.key, question.key, {
                                    [key]: Boolean(next),
                                  })
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
                        patchCategory(category.key, {
                          questions: [...category.questions, blankQuestion()],
                        })
                      }
                    >
                      <PlusIcon className="size-3.5" /> Add question
                    </Button>
                  </div>
                </div>
              )}
            </section>
          ))}

          <Button
            variant="outline"
            className="w-fit gap-1.5"
            onClick={() => {
              const added = blankCategory()
              setCategories((prev) => [...prev, added])
              setOpenKeys((prev) => new Set(prev).add(added.key))
            }}
          >
            <PlusIcon className="size-4" /> Add category
          </Button>

          {/* The rest of the imported workbook. The categories above are only
              part of it, and without this an admin sees seven questions load
              and reasonably concludes the other sections were dropped. They
              are edited here too, and saved with the template. */}
          {/* Loud when nothing came through. An import that finds the seven
              areas and no sections looks like a success until the appraisal
              form comes up short. */}
          {categories.length > 0 && !structure && (
            <section className="grid gap-1 rounded-xl border border-warning/40 bg-warning/5 p-4">
              <p className="text-sm font-medium text-warning">
                No perspectives, development prompts, final review or rating guide were read from
                this file
              </p>
              <p className="text-xs text-muted-foreground">
                Only the performance areas were imported. If the workbook has those sections, check
                that each one&apos;s heading sits on a row of its own.
              </p>
            </section>
          )}

          {/* Each imported section is its own card, alongside the categories. */}
          {structure && <ImportedSectionsEditor structure={structure} onChange={setStructure} />}
        </div>

        {/* The weight total has to stay in view while categories are being
            edited — it is the one rule that decides whether this can be
            activated at all. */}
        <aside className="grid gap-3 xl:sticky xl:top-4">
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
              {weightsOk ? (
                <CheckCircle2Icon className="size-4" />
              ) : (
                <TriangleAlertIcon className="size-4" />
              )}
              Weights total {totalWeight.toFixed(2)}%
            </p>
            <p className="text-xs text-muted-foreground">
              {weightsOk
                ? "Ready to activate."
                : "Must total exactly 100% before this can be activated."}
            </p>
            <p className="text-xs text-muted-foreground">
              {categories.length} categor{categories.length === 1 ? "y" : "ies"} · {questionCount}{" "}
              question
              {questionCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="grid gap-3 rounded-xl border bg-card p-4">
            <Label className="flex items-start gap-2 text-sm font-normal">
              <Checkbox
                checked={activateNow}
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
              {createTemplate.isPending
                ? "Saving…"
                : source
                  ? "Create new version"
                  : "Create template"}
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
