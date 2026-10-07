"use client"

import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PencilIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { InfoTip } from "@/components/ui/tooltip"
import { Sheet, SheetClose, SheetContent } from "@/components/ui/sheet"
import { PanelBody, PanelFooter, PanelHeader, PanelSection } from "@/components/ui/panel"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  maxBirthDateIso,
  MINIMUM_AGE_YEARS,
  personalDetailsSchema,
  type PersonalDetailsValues,
} from "@/features/employees/schemas"
import { GENDER_OPTIONS, OTHER_CITY } from "@/features/employees/constants"
import { AddressLocationFields, DEFAULT_COUNTRY } from "@/features/employees/components/address-location-fields"
import { digitsOnly, mobileDigits } from "@/features/employees/input-format"
import { useUpdatePersonalDetails } from "@/features/employees/hooks/use-employee-mutations"
import type { Employee } from "@/types/employees"

/**
 * Profile → Edit my details: the employee correcting their own personal
 * details. Saved straight away, no approval, and audited server-side.
 *
 * Only the fields EmployeesController#update_personal accepts are here — name,
 * job, managers, roles and pay stay with HR, on the full Edit.
 */
export function PersonalDetailsPanel({
  employee,
  open,
  onOpenChange,
}: {
  employee: Employee
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <PanelHeader
          icon={PencilIcon}
          title="Edit my details"
          description="Your personal, contact and address details. Job details are kept by HR."
        />
        {/* Mounted only while the panel is open, so every opening starts from
            the record as it is now rather than from an earlier, unsaved edit. */}
        <PersonalDetailsForm employee={employee} onSaved={() => onOpenChange(false)} />
      </SheetContent>
    </Sheet>
  )
}

function PersonalDetailsForm({ employee, onSaved }: { employee: Employee; onSaved: () => void }) {
  const update = useUpdatePersonalDetails(String(employee.id))

  const form = useForm<PersonalDetailsValues>({
    // Live, like the employee form: a mistake shows under the field as it is
    // typed rather than only after Save.
    mode: "all",
    resolver: zodResolver(personalDetailsSchema),
    defaultValues: {
      dateOfBirth: employee.dateOfBirth ?? "",
      gender: (employee.gender as PersonalDetailsValues["gender"]) ?? "male",
      phone: employee.phone ?? "",
      personalEmail: employee.personalEmail ?? "",
      addressLine1: employee.addressLine1 ?? "",
      addressLine2: employee.addressLine2 ?? "",
      city: employee.city ?? "",
      cityOther: "",
      state: employee.state ?? "",
      postalCode: employee.postalCode ?? "",
      country: employee.country || DEFAULT_COUNTRY,
      emergencyContactName: employee.emergencyContactName ?? "",
      emergencyContactPhone: employee.emergencyContactPhone ?? "",
    },
  })

  const gender = useWatch({ control: form.control, name: "gender" })

  function onSubmit({ cityOther, ...rest }: PersonalDetailsValues) {
    update.mutate(
      // "Other" is a prompt to type one, not a city anybody lives in.
      { ...rest, city: rest.city === OTHER_CITY ? cityOther?.trim() || null : rest.city },
      { onSuccess: onSaved }
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col" noValidate>
        <PanelBody>
          <fieldset disabled={update.isPending} className="space-y-3">
            <PanelSection title="Personal">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="dateOfBirth"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1.5">
                        <FormLabel>Date of birth</FormLabel>
                        <InfoTip label="Date of birth">Employees must be at least {MINIMUM_AGE_YEARS} years old.</InfoTip>
                      </div>
                      <FormControl>
                        <DatePicker max={maxBirthDateIso()} placeholder="dd/mm/yyyy" clearable {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="personal-gender">Gender</Label>
                  {/* The employee form's Select, kept identical — including
                      never clearing back to empty, which the server refuses. */}
                  <Select
                    items={GENDER_OPTIONS}
                    value={gender}
                    onValueChange={(v) => v && form.setValue("gender", v as PersonalDetailsValues["gender"])}
                  >
                    <SelectTrigger id="personal-gender" className="h-9 w-full">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      {GENDER_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </PanelSection>

            <PanelSection title="Contact">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1.5">
                        <FormLabel>Phone</FormLabel>
                        <InfoTip label="Phone">Indian mobile number, with or without +91.</InfoTip>
                      </div>
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
                <FormField
                  control={form.control}
                  name="personalEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Personal email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </PanelSection>

            <PanelSection title="Address">
              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Street address</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Enter full address" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address line 2</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Apartment, suite, unit, etc. (optional)" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-3.5 sm:grid-cols-2">
                <AddressLocationFields form={form} savedCountry={employee.country} idPrefix="personal" />
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          onChange={(event) => field.onChange(digitsOnly(event.target.value))}
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="6 digits"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </PanelSection>

            <PanelSection title="Emergency contact">
              <div className="grid gap-3.5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-1.5">
                        <FormLabel>Contact phone</FormLabel>
                        <InfoTip label="Contact phone">Indian mobile number, with or without +91.</InfoTip>
                      </div>
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
            </PanelSection>
          </fieldset>
        </PanelBody>
        <PanelFooter>
          <SheetClose render={<Button type="button" variant="outline">Cancel</Button>} />
          <Button
            type="submit"
            disabled={update.isPending}
            className="gap-1.5 bg-role-hr text-role-hr-foreground hover:bg-role-hr/90 shadow-2xs"
          >
            <PencilIcon className="size-4" />
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </PanelFooter>
      </form>
    </Form>
  )
}
