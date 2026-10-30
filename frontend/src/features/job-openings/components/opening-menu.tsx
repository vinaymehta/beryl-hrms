"use client"

import { useState } from "react"
import Link from "next/link"
import {
  ArrowDownToLineIcon,
  ArrowUpToLineIcon,
  CopyIcon,
  EllipsisIcon,
  EyeIcon,
  FileTextIcon,
  LinkIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  Trash2Icon,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { OpeningContent, OpeningHeading } from "@/features/job-openings/components/opening-content"
import { careersPath, publicApiUrl } from "@/features/job-openings/format"
import { useJobOpeningActions, useJobOpenings } from "@/features/job-openings/hooks"
import type { JobOpening } from "@/types/job-openings"

/** Copies the opening's public API address — what the careers website reads. */
export async function copyPublicLink(slug: string) {
  try {
    await navigator.clipboard.writeText(publicApiUrl(slug))
    toast.success("Copied", { description: "The opening's public API link is on your clipboard." })
  } catch {
    toast.error("Couldn't copy the link.", { description: publicApiUrl(slug) })
  }
}

/**
 * Everything that can be done to one opening, grouped: look at it, publish
 * or pause it, move it, copy it, delete it. The same menu on the list's rows
 * and the detail page; `onDeleted` lets the detail page leave once its
 * opening is gone.
 */
export function OpeningMenu({
  opening,
  onDeleted,
  showViewDetails = true,
  triggerVariant = "ghost",
}: {
  opening: JobOpening
  onDeleted?: () => void
  showViewDetails?: boolean
  triggerVariant?: "ghost" | "outline"
}) {
  const { data: openings = [] } = useJobOpenings()
  const { setActive, duplicate, remove, reorder } = useJobOpeningActions()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [previewing, setPreviewing] = useState(false)

  const index = openings.findIndex((item) => item.id === opening.id)
  const atTop = index <= 0
  const atBottom = index === -1 || index === openings.length - 1

  function moveTo(edge: "top" | "bottom") {
    const rest = openings.filter((item) => item.id !== opening.id)
    const current = openings[index] ?? opening
    const ordered = edge === "top" ? [current, ...rest] : [...rest, current]
    reorder.mutate({ ordered, moved: `Moved “${opening.title}” to the ${edge}.` })
  }

  const detailHref = `/job-administration/${opening.id}`

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={triggerVariant}
              size={triggerVariant === "outline" ? "icon" : "icon-sm"}
              aria-label={`Actions for ${opening.title}`}
              className="shrink-0"
            >
              <EllipsisIcon className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuGroup>
            {showViewDetails && (
              <DropdownMenuItem render={<Link href={detailHref} />}>
                <FileTextIcon /> View details
              </DropdownMenuItem>
            )}
            <DropdownMenuItem render={<Link href={`${detailHref}/edit`} />}>
              <PencilIcon /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setPreviewing(true)}>
              <EyeIcon /> Preview
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyPublicLink(opening.slug)}>
              <LinkIcon /> Copy public link
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={setActive.isPending}
            onClick={() => setActive.mutate({ opening, active: !opening.isActive })}
          >
            {opening.isActive ? <PauseIcon /> : <PlayIcon />}
            {opening.isActive ? "Pause" : "Activate"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem disabled={atTop || reorder.isPending} onClick={() => moveTo("top")}>
              <ArrowUpToLineIcon /> Move to top
            </DropdownMenuItem>
            <DropdownMenuItem disabled={atBottom || reorder.isPending} onClick={() => moveTo("bottom")}>
              <ArrowDownToLineIcon /> Move to bottom
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={duplicate.isPending} onClick={() => duplicate.mutate(opening)}>
            <CopyIcon /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmDelete} onOpenChange={(open) => !remove.isPending && setConfirmDelete(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete “{opening.title}”?</DialogTitle>
            <DialogDescription>
              It is removed for good, from this list and from the careers website. To take it down for now and keep
              it, pause it instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline">Cancel</Button>} disabled={remove.isPending} />
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(opening, {
                  onSuccess: () => onDeleted?.(),
                  onSettled: () => setConfirmDelete(false),
                })
              }
            >
              <Trash2Icon className="size-4" />
              {remove.isPending ? "Deleting…" : "Delete opening"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={previewing} onOpenChange={setPreviewing}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-2xl">
          <SheetHeader className="border-b px-5 py-4">
            <SheetTitle>Preview</SheetTitle>
            <SheetDescription>
              {opening.isActive ? "Live" : "Paused"} · {careersPath(opening.slug)}. The website applies its own design.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8">
            <div className="grid gap-8">
              <OpeningHeading opening={opening} />
              <OpeningContent content={opening} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
