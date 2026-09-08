"use client"

import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"

export function RejectLeaveDialog({
  onConfirm,
  isPending,
}: {
  onConfirm: (reviewNote: string) => void
  isPending: boolean
}) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState("")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>Reject</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject this leave request?</DialogTitle>
          <DialogDescription>Let them know why — this note is visible to the employee.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Reason</Label>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Insufficient coverage that week" />
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            variant="destructive"
            disabled={isPending || !note.trim()}
            onClick={() => {
              onConfirm(note)
              setOpen(false)
            }}
          >
            Reject request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
