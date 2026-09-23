"use client"

import { useState } from "react"
import { SendIcon, PenSquareIcon } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { useSendMailMessage } from "@/features/mail/hooks/use-mail-messages"
import { errorMessage } from "@/lib/errors"

export function ComposeMailDialog({
  open,
  onOpenChange,
  connectionId,
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  connectionId: string
  defaultTo?: string
  defaultSubject?: string
  defaultBody?: string
}) {
  const [to, setTo] = useState(defaultTo)
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)
  const [cc, setCc] = useState("")
  const [bcc, setBcc] = useState("")
  const [subject, setSubject] = useState(defaultSubject)
  const [body, setBody] = useState(defaultBody)

  const sendMutation = useSendMailMessage()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!to.trim()) {
      toast.error("Please enter a recipient email address")
      return
    }

    try {
      await sendMutation.mutateAsync({
        connectionId,
        to: to.trim(),
        subject: subject.trim(),
        body: body.trim(),
        ...(showCc && cc.trim() ? { cc: cc.trim() } : {}),
        ...(showBcc && bcc.trim() ? { bcc: bcc.trim() } : {}),
      })
      toast.success("Email sent successfully!")
      setTo("")
      setCc("")
      setBcc("")
      setSubject("")
      setBody("")
      setShowCc(false)
      setShowBcc(false)
      onOpenChange(false)
    } catch (err) {
      toast.error(errorMessage(err, "Failed to send email. Please check your recipient and try again."))
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[45vw] sm:min-w-180 sm:max-w-275 flex flex-col p-0 gap-0 overflow-hidden">
        <SheetHeader className="border-b bg-muted/20 pr-14">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-mail/12 text-accent-mail">
              <PenSquareIcon className="size-5" />
            </span>
            <div>
              <SheetTitle className="text-base font-semibold">New Message</SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Send an email directly through your connected Zoho Mail account.
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-4 space-y-3 flex-1 overflow-y-auto min-h-0">
            {/* Recipient */}
            <div className="grid gap-1">
              <div className="flex items-center justify-between">
                <Label htmlFor="compose-to" className="text-xs font-medium text-muted-foreground">
                  To
                </Label>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {!showCc && (
                    <button
                      type="button"
                      onClick={() => setShowCc(true)}
                      className="hover:text-foreground text-xs font-medium cursor-pointer"
                    >
                      Cc
                    </button>
                  )}
                  {!showBcc && (
                    <button
                      type="button"
                      onClick={() => setShowBcc(true)}
                      className="hover:text-foreground text-xs font-medium cursor-pointer"
                    >
                      Bcc
                    </button>
                  )}
                </div>
              </div>
              <Input
                id="compose-to"
                type="email"
                required
                placeholder="recipient@example.com"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* CC */}
            {showCc && (
              <div className="grid gap-1 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compose-cc" className="text-xs font-medium text-muted-foreground">
                    Cc
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCc(false)
                      setCc("")
                    }}
                    className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <Input
                  id="compose-cc"
                  type="email"
                  placeholder="cc@example.com"
                  value={cc}
                  onChange={(e) => setCc(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}

            {/* BCC */}
            {showBcc && (
              <div className="grid gap-1 animate-in fade-in-50">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compose-bcc" className="text-xs font-medium text-muted-foreground">
                    Bcc
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBcc(false)
                      setBcc("")
                    }}
                    className="text-muted-foreground hover:text-foreground text-xs cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
                <Input
                  id="compose-bcc"
                  type="email"
                  placeholder="bcc@example.com"
                  value={bcc}
                  onChange={(e) => setBcc(e.target.value)}
                  className="text-sm"
                />
              </div>
            )}

            {/* Subject */}
            <div className="grid gap-1">
              <Label htmlFor="compose-subject" className="text-xs font-medium text-muted-foreground">
                Subject
              </Label>
              <Input
                id="compose-subject"
                placeholder="Subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="text-sm font-medium"
              />
            </div>

            {/* Message Body */}
            <div className="grid gap-1 pt-1 flex-1">
              <Label htmlFor="compose-body" className="text-xs font-medium text-muted-foreground">
                Message
              </Label>
              <textarea
                id="compose-body"
                rows={8}
                placeholder="Write your email here..."
                value={body}
                onChange={(e) => setBody(e.target.value)}
                className="w-full rounded-lg border border-input bg-transparent p-3 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 resize-y min-h-36"
              />
            </div>
          </div>

          <SheetFooter className="m-0 p-3 border-t bg-background flex-row items-center justify-between shrink-0">
            <SheetClose render={<Button type="button" variant="outline" size="sm" />}>
              Cancel
            </SheetClose>
            <Button
              type="submit"
              size="sm"
              disabled={sendMutation.isPending || !to.trim()}
              className="gap-1.5"
            >
              {sendMutation.isPending ? (
                <>
                  <span className="size-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Sending...
                </>
              ) : (
                <>
                  <SendIcon className="size-3.5" />
                  Send Email
                </>
              )}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
