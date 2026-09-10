"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { UserIcon, BriefcaseIcon, PhoneIcon, MapPinIcon, ShieldAlertIcon, type LucideIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { employeeFormSchema, type EmployeeFormValues } from "@/features/employees/schemas"
import { useDepartments, useDesignations } from "@/features/employees/hooks/use-employees"
import type { Employee } from "@/types/employees"

function SectionHeader({ icon: Icon, title, subtitle }: { icon: LucideIcon; title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-role-hr/12 text-role-hr">
          <Icon className="size-4" />
        </span>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{subtitle}</p>
    </div>
  )
}

function FormSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4 rounded-xl border bg-muted/20 p-4">{children}</div>
}

export function EmployeeForm({
  employee,
  onSubmit,
  isPending,
}: {
  employee?: Employee
  onSubmit: (values: EmployeeFormValues) => void
  isPending: boolean
}) {
  const { data: departments } = useDepartments()
  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: employee?.firstName ?? "",
      lastName: employee?.lastName ?? "",
      employeeCode: employee?.employeeCode ?? "",
      departmentId: employee?.department?.id ?? "",
      designationId: employee?.designation?.id ?? "",
      dateOfJoining: employee?.dateOfJoining ?? "",
      dateOfBirth: employee?.dateOfBirth ?? "",
      gender: employee?.gender ?? "",
      phone: employee?.phone ?? "",
      personalEmail: employee?.personalEmail ?? "",
      addressLine1: employee?.addressLine1 ?? "",
      addressLine2: employee?.addressLine2 ?? "",
      city: employee?.city ?? "",
      state: employee?.state ?? "",
      postalCode: employee?.postalCode ?? "",
      country: employee?.country ?? "",
      emergencyContactName: employee?.emergencyContactName ?? "",
      emergencyContactPhone: employee?.emergencyContactPhone ?? "",
    },
  })

  const departmentId = form.watch("departmentId")
  const { data: designations } = useDesignations(departmentId || undefined)

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate id="employee-form">
        <fieldset disabled={isPending} className="grid gap-4">
        <FormSection>
          <SectionHeader icon={UserIcon} title="Personal Information" subtitle="Basic identity details" />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="employeeCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Employee code</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="e.g. ACM-007" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dateOfBirth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date of birth</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        <FormSection>
          <SectionHeader icon={BriefcaseIcon} title="Employment Information" subtitle="Department and role details" />
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Department</Label>
              <Select
                value={form.watch("departmentId") || undefined}
                onValueChange={(v) => {
                  form.setValue("departmentId", v ?? undefined)
                  form.setValue("designationId", "")
                }}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                <SelectContent>
                  {departments?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Designation</Label>
              <Select
                value={form.watch("designationId") || undefined}
                onValueChange={(v) => form.setValue("designationId", v ?? undefined)}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="Select designation" /></SelectTrigger>
                <SelectContent>
                  {designations?.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <FormField
            control={form.control}
            name="dateOfJoining"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of joining</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FormSection>

        <FormSection>
          <SectionHeader icon={PhoneIcon} title="Contact Information" subtitle="How can we reach them?" />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone</FormLabel>
                  <FormControl>
                    <Input type="tel" {...field} />
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
        </FormSection>

        <FormSection>
          <SectionHeader icon={MapPinIcon} title="Address" subtitle="Current residential address" />
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
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>City</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>State</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Postal code</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>

        <FormSection>
          <SectionHeader icon={ShieldAlertIcon} title="Emergency Contact" subtitle="Who to reach in an emergency" />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="emergencyContactName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency contact name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emergencyContactPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency contact phone</FormLabel>
                  <FormControl><Input type="tel" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </FormSection>
        </fieldset>
      </form>
    </Form>
  )
}
