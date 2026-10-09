"use client"

import { useState, type Ref } from "react"
import { EyeIcon, EyeOffIcon } from "lucide-react"
import { cn } from "cn"

import { Input } from "@/components/ui/input"
import type { Employee } from "@/types/employees"

/**
 * Bank account number, Aadhaar and PAN: shown masked until the viewer asks to
 * see them. Only ever rendered for somebody the API already sent them to (the
 * employee themselves, Admin/HR) — the masking is about the screen somebody
 * else might be looking at, not about access, which the server decides.
 */

/** True when the API sent this viewer the bank and identity fields at all. */
export function hasSensitiveDetails(employee: Employee | undefined) {
  return employee !== undefined && "aadhaarNumber" in employee
}

/** "123456789012" → "1234 5678 9012", the way it is printed on the card. */
export function formatAadhaar(value: string) {
  return value.replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ")
}

/** "XXXX XXXX 9012" — the last four, as UIDAI's own masked Aadhaar shows it. */
export function maskAadhaar(value: string) {
  return `XXXX XXXX ${value.replace(/\D/g, "").slice(-4)}`
}

/** Everything but the last four characters as X — for an account number or PAN. */
export function maskTail(value: string) {
  return value.length <= 4 ? value : `${"X".repeat(value.length - 4)}${value.slice(-4)}`
}

function RevealButton({
  revealed,
  label,
  onClick,
  disabled,
  className,
}: {
  revealed: boolean
  label: string
  onClick: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
      aria-pressed={revealed}
      className={cn(
        "flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        className
      )}
    >
      {revealed ? <EyeOffIcon className="size-4" aria-hidden /> : <EyeIcon className="size-4" aria-hidden />}
    </button>
  )
}

/** A read-only sensitive value on the profile, masked with an eye to reveal it. */
export function SensitiveValue({
  value,
  label,
  mask,
  format = (v) => v,
}: {
  value: string | null | undefined
  label: string
  mask: (value: string) => string
  format?: (value: string) => string
}) {
  const [revealed, setRevealed] = useState(false)
  if (!value) return <>—</>

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono tracking-wide tabular-nums">{revealed ? format(value) : mask(value)}</span>
      <RevealButton revealed={revealed} label={label} onClick={() => setRevealed((v) => !v)} className="size-6" />
    </span>
  )
}

/**
 * The editing counterpart: while hidden, the box shows the masked value and
 * can't be typed in; revealing it (the eye, or simply clicking into it) shows
 * the real number to edit. Not a password input — that would have browsers
 * offering to save an Aadhaar number as somebody's password.
 *
 * Empty fields start revealed: there is nothing to hide in a blank box.
 */
export function SensitiveInput({
  value,
  onChange,
  onBlur,
  mask,
  label,
  sanitize,
  ref,
  ...props
}: {
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  mask: (value: string) => string
  label: string
  /** Keystroke filter — digits only, upper-case and so on. */
  sanitize: (value: string) => string
  ref?: Ref<HTMLInputElement>
  name?: string
  id?: string
  placeholder?: string
  inputMode?: "numeric" | "text"
  disabled?: boolean
  "aria-invalid"?: boolean
  "aria-describedby"?: string
}) {
  const [revealed, setRevealed] = useState(() => value === "")
  const hidden = !revealed && value !== ""

  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        value={hidden ? mask(value) : value}
        readOnly={hidden}
        onFocus={() => setRevealed(true)}
        onBlur={onBlur}
        onChange={(event) => onChange(sanitize(event.target.value))}
        autoComplete="off"
        spellCheck={false}
        className="pr-9 font-mono tracking-wide"
      />
      <RevealButton
        revealed={!hidden}
        label={label}
        disabled={props.disabled || value === ""}
        onClick={() => setRevealed((v) => !v)}
        className="absolute inset-y-0 right-0 w-9 rounded-l-none rounded-r-lg"
      />
    </div>
  )
}
