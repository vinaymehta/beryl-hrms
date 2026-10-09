"use client"

import { useFieldArray, useWatch, type UseFormReturn } from "react-hook-form"
import { PlusIcon, XIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { InfoTip } from "@/components/ui/tooltip"
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import {
  SensitiveInput,
  formatAadhaar,
  maskAadhaar,
  maskTail,
} from "@/features/employees/components/sensitive-field"
import { digitsOnly, mobileDigits } from "@/features/employees/input-format"
import {
  MAX_EMERGENCY_CONTACTS,
  MAX_OTHER_IDENTITY_NUMBERS,
  MAX_PHONES,
  type PersonalDetailValues,
} from "@/features/employees/schemas"

/** Suggested names for further identity documents; any other name can be typed. */
const IDENTITY_DOCUMENTS = ["Passport", "Driving licence", "Voter ID", "UAN", "ESIC number", "Ration card"]

/**
 * The personal-detail field groups shared by HR's employee form and the
 * employee's own Edit profile sheet — phone numbers, emergency contacts, bank
 * details and identity numbers. Each renders its fields and no card around
 * them, so the caller decides the section it sits in.
 *
 * Generic over the form like AddressLocationFields: both forms carry every
 * PersonalDetailValues field, but react-hook-form's path types can't see that
 * through a generic — hence the one cast in each.
 */
type PersonalForm<T extends PersonalDetailValues> = { form: UseFormReturn<T> }

/** Letters and digits, upper-cased — the PAN and IFSC boxes. */
const upperAlnum = (max: number) => (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, max)

/** The ✕ at the end of a removable row. */
function RemoveRowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0 text-muted-foreground hover:text-destructive"
      aria-label={`Remove ${label}`}
      onClick={onClick}
    >
      <XIcon className="size-4" />
    </Button>
  )
}

/**
 * The employee's own numbers, the main one first. Always at least one box;
 * "Add phone" appends another, and every box but the last remaining one can be
 * removed. Blank boxes are dropped when the form is sent.
 */
export function PhoneListField<T extends PersonalDetailValues>({ form }: PersonalForm<T>) {
  const f = form as unknown as UseFormReturn<PersonalDetailValues>
  const phones = useWatch({ control: f.control, name: "phones" }) ?? []
  const listError = f.formState.errors.phones?.message

  const setPhones = (next: string[]) =>
    f.setValue("phones", next.length ? next : [""], { shouldDirty: true, shouldValidate: true })

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-1.5">
        <Label>Phone numbers</Label>
        <InfoTip label="Phone numbers">
          Indian mobile numbers, with or without +91. The first is their main number.
        </InfoTip>
      </div>
      {phones.map((_, index) => (
        <FormField
          key={index}
          control={f.control}
          name={`phones.${index}`}
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2">
                <FormControl>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    aria-label={index === 0 ? "Main phone number" : `Phone number ${index + 1}`}
                    {...field}
                    onChange={(event) => field.onChange(mobileDigits(event.target.value))}
                    placeholder={index === 0 ? "9876543210 (main)" : "Another number"}
                  />
                </FormControl>
                {phones.length > 1 && (
                  <RemoveRowButton
                    label={`phone number ${index + 1}`}
                    onClick={() => setPhones(phones.filter((__, i) => i !== index))}
                  />
                )}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
      ))}
      {listError && <p className="text-xs text-destructive">{String(listError)}</p>}
      {phones.length < MAX_PHONES && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => setPhones([...phones, ""])}
        >
          <PlusIcon className="size-4" />
          Add phone
        </Button>
      )}
    </div>
  )
}

/**
 * Whoever to call in an emergency — as many as they like up to the cap, each a
 * name, how they're related and a phone. Laid out like the reporting-manager
 * chain: a row per person, "Add contact" below, a ✕ on each.
 */
export function EmergencyContactsField<T extends PersonalDetailValues>({ form }: PersonalForm<T>) {
  const f = form as unknown as UseFormReturn<PersonalDetailValues>
  const { fields, append, remove } = useFieldArray({ control: f.control, name: "emergencyContacts" })
  const listError = f.formState.errors.emergencyContacts?.message

  return (
    <div className="grid gap-3">
      {fields.length === 0 && (
        <p className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
          No emergency contacts yet.
        </p>
      )}
      {fields.map((row, index) => (
        <div key={row.id} className="grid gap-2 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Contact {index + 1}</span>
            <RemoveRowButton label={`emergency contact ${index + 1}`} onClick={() => remove(index)} />
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-3">
            <FormField
              control={f.control}
              name={`emergencyContacts.${index}.name`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Full name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={f.control}
              name={`emergencyContacts.${index}.relation`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Relation</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. Spouse, Mother" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={f.control}
              name={`emergencyContacts.${index}.phone`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      {...field}
                      onChange={(event) => field.onChange(mobileDigits(event.target.value))}
                      placeholder="9876543210"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
      ))}
      {listError && <p className="text-xs text-destructive">{String(listError)}</p>}
      {fields.length < MAX_EMERGENCY_CONTACTS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => append({ name: "", relation: "", phone: "" })}
        >
          <PlusIcon className="size-4" />
          Add contact
        </Button>
      )}
    </div>
  )
}

/** Where their salary is paid: holder, account number (masked) and IFSC. */
export function BankDetailsFields<T extends PersonalDetailValues>({ form }: PersonalForm<T>) {
  const f = form as unknown as UseFormReturn<PersonalDetailValues>

  return (
    <div className="grid items-start gap-3.5 sm:grid-cols-2">
      <FormField
        control={f.control}
        name="bankAccountHolderName"
        render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>Account holder name</FormLabel>
            <FormControl>
              <Input {...field} placeholder="As printed on the passbook" />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={f.control}
        name="bankAccountNumber"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-1.5">
              <FormLabel>Account number</FormLabel>
              <InfoTip label="Account number">9 to 18 digits. Stored encrypted.</InfoTip>
            </div>
            <FormControl>
              <SensitiveInput
                {...field}
                label="account number"
                mask={maskTail}
                sanitize={(v) => digitsOnly(v).slice(0, 18)}
                inputMode="numeric"
                placeholder="9 to 18 digits"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={f.control}
        name="bankIfscCode"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-1.5">
              <FormLabel>IFSC code</FormLabel>
              <InfoTip label="IFSC code">11 characters: 4 letters, a 0, then 6 letters or digits.</InfoTip>
            </div>
            <FormControl>
              <Input
                {...field}
                onChange={(event) => field.onChange(upperAlnum(11)(event.target.value))}
                className="font-mono tracking-wide"
                autoComplete="off"
                placeholder="SBIN0001234"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

/**
 * Aadhaar and PAN NUMBERS. Separate from the Aadhaar/PAN document uploads on
 * the Documents tab, which are what the self-appraisal requires — these are
 * extra and optional.
 */
export function IdentityNumbersFields<T extends PersonalDetailValues>({ form }: PersonalForm<T>) {
  const f = form as unknown as UseFormReturn<PersonalDetailValues>

  return (
    <div className="grid gap-4">
    <div className="grid items-start gap-3.5 sm:grid-cols-2">
      <FormField
        control={f.control}
        name="aadhaarNumber"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-1.5">
              <FormLabel>Aadhaar number</FormLabel>
              <InfoTip label="Aadhaar number">12 digits. Stored encrypted.</InfoTip>
            </div>
            <FormControl>
              <SensitiveInput
                {...field}
                label="Aadhaar number"
                mask={maskAadhaar}
                sanitize={(v) => formatAadhaar(digitsOnly(v).slice(0, 12))}
                inputMode="numeric"
                placeholder="1234 5678 9012"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={f.control}
        name="panNumber"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-1.5">
              <FormLabel>PAN number</FormLabel>
              <InfoTip label="PAN number">5 letters, 4 digits, then 1 letter. Stored encrypted.</InfoTip>
            </div>
            <FormControl>
              <SensitiveInput
                {...field}
                label="PAN number"
                mask={maskTail}
                sanitize={upperAlnum(10)}
                placeholder="ABCDE1234F"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
    <OtherIdentityNumbersField form={form} />
    </div>
  )
}

/**
 * Any further identity documents — passport, driving licence, UAN… — as rows of document name and number.
 * Blank rows are dropped when the form is sent; numbers are stored encrypted like Aadhaar and PAN.
 */
function OtherIdentityNumbersField<T extends PersonalDetailValues>({ form }: PersonalForm<T>) {
  const f = form as unknown as UseFormReturn<PersonalDetailValues>
  const { fields, append, remove } = useFieldArray({ control: f.control, name: "otherIdentityNumbers" })
  const listError = f.formState.errors.otherIdentityNumbers?.message

  return (
    <div className="grid gap-2.5 border-t pt-4">
      <div className="flex items-center gap-1.5">
        <Label>Other identity numbers</Label>
        <InfoTip label="Other identity numbers">Passport, driving licence, UAN and the like. Stored encrypted.</InfoTip>
      </div>
      <datalist id="identity-document-names">
        {IDENTITY_DOCUMENTS.map((name) => <option key={name} value={name} />)}
      </datalist>
      {fields.map((row, index) => (
        <div key={row.id} className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <FormField
            control={f.control}
            name={`otherIdentityNumbers.${index}.label`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Input {...field} list="identity-document-names" aria-label={`Document ${index + 1} name`} placeholder="Document, e.g. Passport" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={f.control}
            name={`otherIdentityNumbers.${index}.number`}
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <SensitiveInput
                    {...field}
                    label={`document ${index + 1} number`}
                    mask={maskTail}
                    sanitize={(v) => v.toUpperCase().replace(/[^A-Z0-9 /-]/g, "").slice(0, 40)}
                    placeholder="Number"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <RemoveRowButton label={`identity number ${index + 1}`} onClick={() => remove(index)} />
        </div>
      ))}
      {listError && <p className="text-xs text-destructive">{String(listError)}</p>}
      {fields.length < MAX_OTHER_IDENTITY_NUMBERS && (
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => append({ label: "", number: "" })}>
          <PlusIcon className="size-4" />
          Add identity number
        </Button>
      )}
    </div>
  )
}
