"use client"

import { useState } from "react"
import { ChevronDownIcon, ChevronUpIcon, GripVerticalIcon, PlusIcon, XIcon } from "lucide-react"
import { cn } from "cn"

import { LIST_ITEM_MAX, LIST_SIZE_MAX } from "@/features/job-openings/validation"

/** A list line with a stable key, so moving and removing keep focus and text where they belong. */
export interface ListItem {
  key: string
  text: string
}

let nextKey = 0
export function toListItems(texts: string[]): ListItem[] {
  return texts.map((text) => ({ key: `item-${nextKey++}`, text }))
}

/**
 * An editable bullet list — one of the website's responsibilities,
 * requirements, nice-to-haves or growth items — as bordered, numbered rows.
 * Reorder by dragging the handle, or with the arrows (keyboard and touch).
 * Blank lines are allowed while typing and dropped on save, as on the server.
 */
export function ListEditor({
  id,
  label,
  itemLabel,
  items,
  onChange,
  placeholder,
  error,
}: {
  id: string
  label: string
  /** Singular, for "Add …" and the row controls' names. */
  itemLabel: string
  items: ListItem[]
  onChange: (items: ListItem[]) => void
  placeholder: string
  error?: string
}) {
  // A row only becomes draggable while its handle is held, so text in the
  // textarea can still be selected with the mouse.
  const [armed, setArmed] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)
  const filled = items.filter((item) => item.text.trim()).length
  const full = items.length >= LIST_SIZE_MAX

  function update(index: number, text: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, text } : item)))
  }

  function moveTo(from: number, to: number) {
    if (from === to || to < 0 || to >= items.length) return
    const next = [...items]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  function add() {
    onChange([...items, ...toListItems([""])])
    // Focus the new line once it has rendered.
    requestAnimationFrame(() => {
      const fields = document.querySelectorAll<HTMLTextAreaElement>(`[data-list="${id}"] textarea`)
      fields[fields.length - 1]?.focus()
    })
  }

  const control =
    "flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-30"

  return (
    <fieldset className="grid gap-2" data-list={id} id={id}>
      <div className="flex items-baseline justify-between gap-3">
        <legend className="text-sm font-medium">{label}</legend>
        <span className="text-xs text-muted-foreground tabular-nums">
          {filled}
          <span className="text-muted-foreground/60"> / {LIST_SIZE_MAX}</span>
        </span>
      </div>

      <div className={cn("overflow-hidden rounded-lg border", error && "border-destructive")}>
        <ol className="divide-y">
          {items.map((item, index) => {
            const length = item.text.trim().length
            const tooLong = length > LIST_ITEM_MAX
            return (
              <li
                key={item.key}
                draggable={armed === item.key}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move"
                  event.dataTransfer.setData("text/plain", item.key)
                  setDragging(item.key)
                }}
                onDragOver={(event) => {
                  if (!dragging) return
                  event.preventDefault()
                  moveTo(
                    items.findIndex((candidate) => candidate.key === dragging),
                    index
                  )
                }}
                onDrop={(event) => event.preventDefault()}
                onDragEnd={() => {
                  setDragging(null)
                  setArmed(null)
                }}
                className={cn(
                  "group/item flex items-start gap-1.5 bg-background py-1.5 pr-2 pl-1 transition-colors focus-within:bg-muted/30 dark:bg-input/10",
                  dragging === item.key && "opacity-50"
                )}
              >
                <span
                  aria-hidden
                  title="Drag to reorder"
                  onPointerDown={() => setArmed(item.key)}
                  onPointerUp={() => setArmed(null)}
                  className="mt-1.5 hidden h-6 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground/50 hover:text-muted-foreground active:cursor-grabbing sm:flex"
                >
                  <GripVerticalIcon className="size-3.5" />
                </span>
                <span className="mt-1.5 ml-1 w-5 shrink-0 text-right text-xs font-medium text-muted-foreground tabular-nums sm:ml-0">
                  {index + 1}.
                </span>
                <div className="grid min-w-0 flex-1">
                  <textarea
                    rows={1}
                    value={item.text}
                    aria-label={`${label} ${index + 1}`}
                    aria-invalid={tooLong || undefined}
                    placeholder={placeholder}
                    onChange={(event) => update(index, event.target.value)}
                    className="field-sizing-content min-h-8 w-full resize-none bg-transparent px-1 py-1 text-sm leading-6 outline-none placeholder:text-muted-foreground/70"
                  />
                  {tooLong && (
                    <p className="px-1 pb-1 text-xs text-destructive">
                      {length}/{LIST_ITEM_MAX} characters — shorten this {itemLabel}.
                    </p>
                  )}
                </div>
                <div className="mt-1 flex shrink-0 items-center sm:opacity-0 sm:transition-opacity sm:group-focus-within/item:opacity-100 sm:group-hover/item:opacity-100">
                  <button
                    type="button"
                    className={control}
                    aria-label={`Move ${itemLabel} ${index + 1} up`}
                    title="Move up"
                    disabled={index === 0}
                    onClick={() => moveTo(index, index - 1)}
                  >
                    <ChevronUpIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className={control}
                    aria-label={`Move ${itemLabel} ${index + 1} down`}
                    title="Move down"
                    disabled={index === items.length - 1}
                    onClick={() => moveTo(index, index + 1)}
                  >
                    <ChevronDownIcon className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className={cn(control, "hover:bg-destructive/10 hover:text-destructive")}
                    aria-label={`Remove ${itemLabel} ${index + 1}`}
                    title="Remove"
                    onClick={() => onChange(items.filter((_, i) => i !== index))}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
        <button
          type="button"
          disabled={full}
          onClick={add}
          className={cn(
            "flex w-full items-center gap-2 bg-muted/20 px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:bg-muted/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
            items.length > 0 && "border-t"
          )}
        >
          <PlusIcon className="size-4" />
          {full ? `Up to ${LIST_SIZE_MAX} items` : `Add ${itemLabel}`}
        </button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </fieldset>
  )
}
