"use client"

import { useMemo, useState } from "react"
import { PlusIcon, Trash2Icon, GripVerticalIcon, TriangleAlertIcon, CheckCircle2Icon } from "lucide-react"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { APPRAISAL_LENSES } from "@/features/appraisals/constants"
import { useCreateAppraisalTemplate } from "@/features/appraisals/hooks/use-appraisal-mutations"
import type { AppraisalLens, AppraisalTemplate } from "@/types/appraisals"

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
  lens: AppraisalLens
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
 * HR/Admin's template builder (scope §5): categories, questions, descriptions,
 * weights, display order, self-/manager-rating settings and required comments.
 *
 * Always creates — never edits in place. A template a cycle has started against
 * is frozen (§11), so "duplicate as a new version" is the only safe way to
 * change one, and making that the single path removes the chance of silently
 * rewriting the questions a historical appraisal was answered against.
 *
 * The 100% weight rule (§5) is shown live here and enforced again server-side,
 * so a template can't be activated in a state the engine would reject.
 */
export function TemplateBuilder({
  open,
  onOpenChange,
  source,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** When given, the form opens pre-filled as the next version of this one. */
  source?: AppraisalTemplate
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && <TemplateBuilderBody key={source?.id ?? "new"} onOpenChange={onOpenChange} source={source} />}
    </Sheet>
  )
}

function TemplateBuilderBody({
  onOpenChange,
  source,
}: {
  onOpenChange: (open: boolean) => void
  source?: AppraisalTemplate
}) {
  const [name, setName] = useState(source ? `${source.name}` : "")
  const [description, setDescription] = useState(source?.description ?? "")
  const [categories, setCategories] = useState<DraftCategory[]>(() => categoriesFrom(source))
  const [activateNow, setActivateNow] = useState(true)
  const createTemplate = useCreateAppraisalTemplate()

  const totalWeight = useMemo(
    () => categories.reduce((sum, category) => sum + (Number(category.weight) || 0), 0),
    [categories]
  )
  const weightsOk = Math.abs(totalWeight - 100) < 0.01
  const hasQuestions = categories.every((category) => category.questions.some((q) => q.prompt.trim()))
  const namesOk = Boolean(name.trim()) && categories.every((category) => category.name.trim())
  // Activation is what triggers the server's 100% check, so a draft can be
  // saved incomplete but an active template cannot.
  const canSave = namesOk && hasQuestions && (!activateNow || weightsOk)

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

  function handleSave() {
    createTemplate.mutate(
      {
        name,
        description,
        status: activateNow ? "active" : "draft",
        categoriesAttributes: categories.map((category, index) => ({
          name: category.name,
          description: category.description,
          lens: category.lens,
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
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:w-[55vw] sm:min-w-180 sm:max-w-275">
      <SheetHeader className="border-b bg-role-hr/5 pr-14">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-role-hr/12 text-role-hr">
            <GripVerticalIcon className="size-5" />
          </span>
          <div>
            <SheetTitle className="text-lg">
              {source ? `New version of ${source.name}` : "New appraisal template"}
            </SheetTitle>
            <SheetDescription>
              {source
                ? "The original stays exactly as it is, so historical appraisals are untouched."
                : "Weighted categories and the questions inside them. Weights must total 100%."}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      {/* Block layout, not `grid flex-1`. As a grid that is ALSO the flex-1
          scroll container this had a definite height, so its auto rows were
          compressed — and because each card sets `overflow-hidden`, their
          automatic minimum size resolves to 0 (min-height:auto only applies
          when overflow is visible), so nothing stopped them collapsing to the
          header. Every card rendered 40px tall once there were a few of them.
          `space-y-4` gives the same rhythm with content-sized children. */}
      <div className="flex-1 space-y-4 overflow-y-auto bg-muted/30 p-4">
        <section className="grid gap-3.5 rounded-xl border bg-card p-4 shadow-2xs">
          <div className="grid gap-1.5">
            <Label htmlFor="template-name">Template name</Label>
            <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="2026 Performance Review" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="template-description">Description</Label>
            <Input id="template-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </section>

        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
            weightsOk ? "border-success/40 bg-success/5 text-success" : "border-warning/40 bg-warning/5 text-warning"
          )}
        >
          {weightsOk ? <CheckCircle2Icon className="size-4" /> : <TriangleAlertIcon className="size-4" />}
          <span className="font-medium tabular-nums">Weights total {totalWeight.toFixed(2)}%</span>
          <span className="text-xs opacity-80">
            {weightsOk ? "Ready to activate." : "Must total exactly 100% before this can be activated."}
          </span>
        </div>

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
                    onValueChange={(next) => patchCategory(category.key, { lens: (next as AppraisalLens) ?? "past" })}
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
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t bg-background p-4">
        <Label className="flex items-center gap-2 text-sm font-normal">
          <Checkbox checked={activateNow} onCheckedChange={(next) => setActivateNow(Boolean(next))} />
          Activate now — only active templates can be used by a cycle
        </Label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-role-hr text-role-hr-foreground shadow-2xs hover:bg-role-hr/90"
            disabled={!canSave || createTemplate.isPending}
            onClick={handleSave}
          >
            {createTemplate.isPending ? "Saving…" : source ? "Create new version" : "Create template"}
          </Button>
        </div>
      </div>
    </SheetContent>
  )
}
