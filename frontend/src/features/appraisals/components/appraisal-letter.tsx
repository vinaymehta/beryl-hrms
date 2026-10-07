"use client"

import { useEffect, useRef, useState } from "react"
import {
  CheckCircle2Icon,
  DownloadIcon,
  EyeIcon,
  FileTextIcon,
  ImageUpIcon,
  PenLineIcon,
  SignatureIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "cn"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { PdfPages } from "@/components/ui/pdf-pages"
import { PanelBody, PanelFooter, PanelHeader, PanelSection } from "@/components/ui/panel"
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet"
import { SignaturePad, type SignaturePadHandle } from "@/components/ui/signature-pad"
import { Skeleton } from "@/components/ui/skeleton"
import { appraisalsApi } from "@/features/appraisals/api"
import { useSignLetter } from "@/features/appraisals/hooks/use-appraisal-mutations"
import { useAppraisalLetter } from "@/features/appraisals/hooks/use-appraisals"
import { errorMessage } from "@/lib/errors"
import type { AppraisalDetail } from "@/types/appraisals"

type SignatureMethod = "drawn" | "uploaded"

/** The server's limit, checked here first so nobody waits on an upload that will be refused. */
const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024
const SIGNATURE_TYPES = ["image/png", "image/jpeg"]

function formatSignedOn(value: string | null | undefined) {
  return value
    ? new Date(value).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—"
}

/**
 * The letter in a plain window: its pages at 100% on white, and an X to close.
 * No viewer chrome of any kind — the pages are drawn by PdfPages, not by the
 * browser's PDF viewer. Used by the employee and by Admin/HR alike;
 * `draft` is Admin/HR's preview of the saved decision before release.
 */
export function LetterWindow({
  appraisal,
  open,
  onOpenChange,
  draft = false,
}: {
  appraisal: AppraisalDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  draft?: boolean
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* The dialog's own X, top right, is the only control. */}
      <DialogContent className="flex h-[92vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[860px] [&>[data-slot=dialog-close]]:top-3 [&>[data-slot=dialog-close]]:right-5">
        <DialogTitle className="sr-only">Appraisal letter</DialogTitle>
        {/* Mounted only while open, so the letter is read when it is opened. */}
        {open && <LetterPages appraisal={appraisal} draft={draft} />}
      </DialogContent>
    </Dialog>
  )
}

function LetterPages({ appraisal, draft }: { appraisal: AppraisalDetail; draft: boolean }) {
  const letter = appraisal.letter
  // What makes it a different file: the signed copy replaces the issued one.
  const version = letter?.signed
    ? `signed-${letter.signedAt ?? ""}`
    : `issued-${letter?.sha256 ?? ""}`
  const file = useAppraisalLetter(appraisal.id, version, true, { draft })

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-white">
      {file.isPending ? (
        <div className="mx-auto grid w-full max-w-[794px] gap-3 p-8">
          <Skeleton className="size-12 rounded-full" />
          <Skeleton className="h-4 w-2/5" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
      ) : file.isError ? (
        <div className="grid h-full place-content-center justify-items-center gap-2 p-6 text-center">
          <p className="text-sm font-semibold text-neutral-900">Couldn&apos;t open the letter</p>
          <p className="max-w-sm text-xs text-neutral-500">
            {errorMessage(file.error, "It may still be getting ready.")}
          </p>
          <Button variant="outline" size="sm" onClick={() => file.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <PdfPages src={file.data} />
      )}
    </div>
  )
}

/** Opens the letter window — the one way the letter is looked at, everywhere. */
function PreviewLetterButton({
  appraisal,
  label = "Preview",
  variant = "outline",
}: {
  appraisal: AppraisalDetail
  label?: string
  variant?: "outline" | "ghost"
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <EyeIcon className="size-3.5" /> {label}
      </Button>
      <LetterWindow appraisal={appraisal} open={open} onOpenChange={setOpen} />
    </>
  )
}

/** A link-styled button that downloads the letter (the signed copy once there is one). */
function DownloadLetterButton({
  appraisal,
  label,
  variant = "outline",
}: {
  appraisal: AppraisalDetail
  label: string
  variant?: "outline" | "ghost" | "link"
}) {
  return (
    <Button
      variant={variant}
      size="sm"
      className="gap-1.5"
      // A real anchor: the PDF is a streamed download, not a JSON call.
      nativeButton={false}
      render={<a href={appraisalsApi.letterUrl(appraisal.id, { download: true })} />}
    >
      <DownloadIcon className="size-3.5" /> {label}
    </Button>
  )
}

/**
 * The employee's Letter tab — first in line once the appraisal is released:
 * where the letter stands, the letter itself, and the way into signing it.
 */
export function LetterTab({ appraisal }: { appraisal: AppraisalDetail }) {
  const [open, setOpen] = useState(false)
  const letter = appraisal.letter
  const signed = Boolean(letter?.signed)

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-full",
            signed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
          )}
        >
          {signed ? <CheckCircle2Icon className="size-5" /> : <FileTextIcon className="size-5" />}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">Appraisal letter</h2>
            <span
              className={cn(
                "inline-flex h-5 items-center rounded-full px-2 text-xs font-medium",
                signed ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
              )}
            >
              {signed ? "Signed" : "Awaiting your signature"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {signed
              ? `Signed on ${formatSignedOn(letter?.signedAt)}${
                  letter?.signedName ? ` by ${letter.signedName}` : ""
                } · HR has the signed copy, and it is in your Documents.`
              : "Preview your letter, then sign it to send it back to HR."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PreviewLetterButton appraisal={appraisal} />
        <DownloadLetterButton
          appraisal={appraisal}
          label={signed ? "Download signed copy" : "Download"}
        />
        {appraisal.viewer.canSign && !signed && (
          <Button
            size="sm"
            className="gap-1.5 bg-success text-success-foreground shadow-2xs hover:bg-success/90"
            onClick={() => setOpen(true)}
          >
            <SignatureIcon className="size-3.5" /> Review &amp; sign
          </Button>
        )}
      </div>

      <SignLetterPanel appraisal={appraisal} open={open} onOpenChange={setOpen} />
    </div>
  )
}

/**
 * Review & sign — the side panel that replaced Acknowledge. The letter, a
 * signature (drawn on the pad, or an uploaded image of one), and an explicit
 * "I accept". Once signed it shows when, and offers the signed copy.
 */
export function SignLetterPanel({
  appraisal,
  open,
  onOpenChange,
}: {
  appraisal: AppraisalDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl">
        {/* Its own component so the signature, the tick and the chosen tab
            start fresh each time the panel opens — the content unmounts on close. */}
        <SignLetterContent appraisal={appraisal} />
      </SheetContent>
    </Sheet>
  )
}

function SignLetterContent({ appraisal }: { appraisal: AppraisalDetail }) {
  const letter = appraisal.letter
  const signed = Boolean(letter?.signed)
  const sign = useSignLetter(appraisal.id)
  const padRef = useRef<SignaturePadHandle>(null)

  const [method, setMethod] = useState<SignatureMethod>("drawn")
  const [padEmpty, setPadEmpty] = useState(true)
  const [upload, setUpload] = useState<File | null>(null)
  const [accepted, setAccepted] = useState(false)
  const [preparing, setPreparing] = useState(false)

  const hasSignature = method === "drawn" ? !padEmpty : upload !== null
  const busy = sign.isPending || preparing

  async function submit() {
    setPreparing(true)
    const file = method === "drawn" ? await padRef.current?.toFile() : upload
    setPreparing(false)
    if (!file) {
      toast.error(
        method === "drawn"
          ? "Please draw your signature first."
          : "Please choose an image of your signature."
      )
      return
    }
    const form = new FormData()
    form.append("signature", file)
    form.append("accept", "true")
    form.append("signatureMethod", method)
    sign.mutate(form)
  }

  return (
    <>
      <PanelHeader
        icon={SignatureIcon}
        title={signed ? "Your signed letter" : "Review & sign your letter"}
        description={
          signed
            ? `Signed on ${formatSignedOn(letter?.signedAt)}.`
            : "Preview it, add your signature, and it is sent back to HR."
        }
      />
      <PanelBody>
        <PanelSection
          title={signed ? "Signed letter" : "Your letter"}
          action={
            signed ? undefined : (
              <DownloadLetterButton appraisal={appraisal} label="Download" variant="ghost" />
            )
          }
        >
          <div className="flex items-center gap-3 rounded-lg border px-3 py-2.5">
            <FileTextIcon className="size-5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">
              {signed ? "Signed appraisal letter" : "Appraisal letter"}
            </p>
            <PreviewLetterButton appraisal={appraisal} />
          </div>
        </PanelSection>

        {signed ? (
          <PanelSection title="Signature">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2Icon className="size-4 text-success" />
              Signed on {formatSignedOn(letter?.signedAt)}
              {letter?.signedName ? ` by ${letter.signedName}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              HR has been sent the signed letter, and a copy has been added to your Documents.
            </p>
            <div>
              <DownloadLetterButton appraisal={appraisal} label="Download signed copy" />
            </div>
          </PanelSection>
        ) : (
          <PanelSection title="Your signature">
            <div
              role="tablist"
              aria-label="How to sign"
              className="inline-flex w-fit rounded-lg border bg-muted/50 p-0.5"
            >
              {[
                { id: "drawn" as const, label: "Draw", icon: PenLineIcon },
                { id: "uploaded" as const, label: "Upload", icon: ImageUpIcon },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={method === tab.id}
                  aria-controls={`signature-${tab.id}`}
                  disabled={busy}
                  onClick={() => setMethod(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors disabled:opacity-60",
                    method === tab.id
                      ? "bg-background font-medium text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon className="size-3.5" /> {tab.label}
                </button>
              ))}
            </div>

            {/* Both stay mounted, so switching tabs keeps what was drawn or
                chosen; the one not in use is only hidden. */}
            <div id="signature-drawn" role="tabpanel" hidden={method !== "drawn"}>
              <SignaturePad ref={padRef} onChange={setPadEmpty} disabled={busy} />
            </div>
            <div id="signature-uploaded" role="tabpanel" hidden={method !== "uploaded"}>
              <SignatureUpload file={upload} onFile={setUpload} disabled={busy} />
            </div>

            <label className="flex items-start gap-2.5 text-sm">
              <Checkbox
                className="mt-0.5"
                checked={accepted}
                disabled={busy}
                onCheckedChange={(checked) => setAccepted(checked === true)}
              />
              <span>I have read and accept this letter</span>
            </label>
          </PanelSection>
        )}
      </PanelBody>
      <PanelFooter>
        <SheetClose render={<Button variant="outline">{signed ? "Close" : "Cancel"}</Button>} />
        {!signed && (
          <Button
            className="gap-1.5 bg-success text-success-foreground shadow-2xs hover:bg-success/90"
            disabled={!hasSignature || !accepted || busy}
            onClick={submit}
          >
            <SignatureIcon className="size-4" /> {busy ? "Signing…" : "Sign & send"}
          </Button>
        )}
      </PanelFooter>
    </>
  )
}

/** An image of a signature: PNG or JPG, 2 MB at most, previewed once chosen. */
function SignatureUpload({
  file,
  onFile,
  disabled,
}: {
  file: File | null
  onFile: (file: File | null) => void
  disabled: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Each preview URL is released when it is replaced, and on the way out.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview)
    },
    [preview]
  )

  function choose(next: File | undefined) {
    if (!next) return
    if (!SIGNATURE_TYPES.includes(next.type)) {
      setError("Signature must be a PNG or JPG image.")
      return
    }
    if (next.size > MAX_SIGNATURE_BYTES) {
      setError("Signature must be 2 MB or smaller.")
      return
    }
    setError(null)
    setPreview(URL.createObjectURL(next))
    onFile(next)
  }

  function remove() {
    setPreview(null)
    setError(null)
    onFile(null)
  }

  return (
    <div className="grid gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          choose(event.target.files?.[0])
          // Lets the same file be picked again after a Remove.
          event.target.value = ""
        }}
      />

      {file && preview ? (
        <div className="grid gap-2">
          <div className="flex h-[180px] items-center justify-center rounded-lg border bg-white p-4">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL, not a remote asset */}
            <img
              src={preview}
              alt="Your signature"
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{file.name}</p>
            <Button
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              Replace
            </Button>
            <Button variant="ghost" size="sm" disabled={disabled} onClick={remove}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex h-[180px] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-60"
        >
          <ImageUpIcon className="size-5" />
          <span className="font-medium">Choose an image of your signature</span>
          <span className="text-xs">PNG or JPG, up to 2 MB</span>
        </button>
      )}

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-destructive" role="alert">
          <TriangleAlertIcon className="size-3.5" /> {error}
        </p>
      )}
    </div>
  )
}

/**
 * Where the letter stands, for Admin/HR (and reviewers once it is signed):
 * signed, by whom and when, with the signed copy — or still awaiting the
 * employee's signature.
 */
export function LetterStatusLine({ appraisal }: { appraisal: AppraisalDetail }) {
  const letter = appraisal.letter
  if (!letter?.available) return null

  return (
    <div className="mr-auto flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />
      <span className="font-medium">Letter:</span>
      {letter.signed ? (
        <>
          <span className="text-muted-foreground">
            Signed {formatSignedOn(letter.signedAt)}
            {letter.signedName ? ` by ${letter.signedName}` : ""} —
          </span>
          <ViewLetterLink appraisal={appraisal} label="View signed letter" />
          <span className="text-muted-foreground">·</span>
          <a
            href={appraisalsApi.letterUrl(appraisal.id, { download: true })}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Download
          </a>
        </>
      ) : (
        <>
          <span className="text-muted-foreground">Sent, awaiting signature —</span>
          <ViewLetterLink appraisal={appraisal} label="View letter" />
        </>
      )}
    </div>
  )
}

/** A text link that opens the letter window. */
function ViewLetterLink({ appraisal, label }: { appraisal: AppraisalDetail; label: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-medium text-primary underline-offset-4 hover:underline"
      >
        {label}
      </button>
      <LetterWindow appraisal={appraisal} open={open} onOpenChange={setOpen} />
    </>
  )
}
