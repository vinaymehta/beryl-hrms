"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { useDepartments, useDesignations, useEmploymentTypes } from "@/features/employees/hooks/use-employees"
import {
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useCreateDesignation,
  useUpdateDesignation,
  useDeleteDesignation,
  useCreateEmploymentType,
  useUpdateEmploymentType,
  useDeleteEmploymentType,
} from "@/features/employees/hooks/use-employee-mutations"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import type { Department, Designation, EmploymentType } from "@/types/employees"
import {
  departmentFormSchema,
  designationFormSchema,
  employmentTypeFormSchema,
  type DepartmentFormValues,
  type DesignationFormValues,
  type EmploymentTypeFormValues,
} from "@/features/employees/schemas"

/**
 * Create and edit in one dialog.
 *
 * The two differ only in where the values start and which mutation runs, and
 * two near-identical forms would be two places to keep the validation, the
 * field list and the reset behaviour in step.
 */
function DepartmentDialog({
  department,
  open,
  onOpenChange,
}: {
  department?: Department
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const create = useCreateDepartment()
  const update = useUpdateDepartment()
  const editing = !!department
  const saving = create.isPending || update.isPending

  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: { name: department?.name ?? "", description: department?.description ?? "" },
  })

  function onSubmit(values: DepartmentFormValues) {
    const done = {
      onSuccess: () => {
        onOpenChange(false)
        form.reset()
      },
    }
    if (department) update.mutate({ id: department.id, values }, done)
    else create.mutate(values, done)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${department.name}` : "New department"}</DialogTitle>
          <DialogDescription>Departments group employees and designations for reporting.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={saving} onClick={form.handleSubmit(onSubmit)}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/** Read-only detail, for looking without risking an edit. */
function DepartmentDetailDialog({
  department,
  onOpenChange,
}: {
  department: Department
  onOpenChange: (next: boolean) => void
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{department.name}</DialogTitle>
          <DialogDescription>
            {department.description || "No description."}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-2 gap-4 border-t pt-4">
          <div>
            <dt className="text-xs text-muted-foreground">Employees</dt>
            <dd className="text-lg font-semibold tabular-nums">{department.employeeCount}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Designations</dt>
            <dd className="text-lg font-semibold tabular-nums">{department.designationCount}</dd>
          </div>
        </dl>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Confirmation before deleting.
 *
 * It names how many people are in the department, because that is the
 * consequence the person pressing the button cannot see from the row — and a
 * department with thirty employees in it is almost never the one they meant.
 */
function DeleteDepartmentDialog({
  department,
  onOpenChange,
}: {
  department: Department
  onOpenChange: (next: boolean) => void
}) {
  const remove = useDeleteDepartment()

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {department.name}?</DialogTitle>
          <DialogDescription>
            {department.employeeCount > 0
              ? `${department.employeeCount} ${department.employeeCount === 1 ? "employee is" : "employees are"} in this department. They keep their records, but the department stops being offered anywhere.`
              : "It will stop being offered anywhere in the app."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(department.id, { onSuccess: () => onOpenChange(false) })}
          >
            {remove.isPending ? "Deleting…" : "Delete department"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Deleting several at once.
 *
 * One request per department rather than a bulk endpoint, because there isn't
 * one and inventing it for this is more surface than the feature is worth. The
 * total headcount is stated up front for the same reason the single delete
 * states it: it is the consequence a list of names does not show.
 */
function BulkDeleteDepartmentsDialog({
  departments,
  onOpenChange,
  onDone,
}: {
  departments: Department[]
  onOpenChange: (next: boolean) => void
  onDone: () => void
}) {
  const remove = useDeleteDepartment()
  const [working, setWorking] = useState(false)
  const people = departments.reduce((sum, d) => sum + d.employeeCount, 0)

  async function confirm() {
    setWorking(true)
    // Sequential, so a failure part-way leaves a comprehensible state rather
    // than an arbitrary subset gone.
    for (const d of departments) {
      await new Promise<void>((resolve) => {
        remove.mutate(d.id, { onSuccess: () => resolve(), onError: () => resolve() })
      })
    }
    setWorking(false)
    onDone()
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Delete {departments.length} {departments.length === 1 ? "department" : "departments"}?
          </DialogTitle>
          <DialogDescription>
            {departments.map((d) => d.name).join(", ")}.
            {people > 0
              ? ` ${people} ${people === 1 ? "employee keeps their record" : "employees keep their records"}, but these stop being offered anywhere.`
              : " They will stop being offered anywhere in the app."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button variant="destructive" disabled={working} onClick={confirm}>
            {working ? "Deleting…" : "Delete them"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Create and edit a job title, in one dialog like DepartmentDialog. */
function JobTitleDialog({
  designation,
  onOpenChange,
}: {
  designation?: Designation
  onOpenChange: (next: boolean) => void
}) {
  const { data: departments } = useDepartments()
  const create = useCreateDesignation()
  const update = useUpdateDesignation()
  const editing = !!designation
  const saving = create.isPending || update.isPending

  const form = useForm<DesignationFormValues>({
    resolver: zodResolver(designationFormSchema),
    defaultValues: {
      title: designation?.title ?? "",
      departmentId: designation?.departmentId != null ? String(designation.departmentId) : "",
    },
  })

  function onSubmit(values: DesignationFormValues) {
    const done = { onSuccess: () => onOpenChange(false) }
    if (designation) update.mutate({ id: designation.id, values }, done)
    else create.mutate(values, done)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${designation.title}` : "New job title"}</DialogTitle>
          <DialogDescription>Job titles sit within a department.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="departmentId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department</FormLabel>
                  <Select
                    items={departments?.map((d) => ({ value: String(d.id), label: d.name }))}
                    value={field.value || null}
                    onValueChange={(v) => field.onChange(v ?? "")}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments?.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={saving} onClick={form.handleSubmit(onSubmit)}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/** Create and edit an employee type. */
function EmploymentTypeDialog({
  employmentType,
  onOpenChange,
}: {
  employmentType?: EmploymentType
  onOpenChange: (next: boolean) => void
}) {
  const create = useCreateEmploymentType()
  const update = useUpdateEmploymentType()
  const editing = !!employmentType
  const saving = create.isPending || update.isPending

  const form = useForm<EmploymentTypeFormValues>({
    resolver: zodResolver(employmentTypeFormSchema),
    defaultValues: { name: employmentType?.name ?? "", description: employmentType?.description ?? "" },
  })

  function onSubmit(values: EmploymentTypeFormValues) {
    const done = { onSuccess: () => onOpenChange(false) }
    if (employmentType) update.mutate({ id: employmentType.id, values }, done)
    else create.mutate(values, done)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${employmentType.name}` : "New employee type"}</DialogTitle>
          <DialogDescription>Offered on the employee form, e.g. Full-time or Contract.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={saving} onClick={form.handleSubmit(onSubmit)}>
                {saving ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/** A plain "are you sure" for job titles and employee types. */
function ConfirmDeleteDialog({
  name,
  detail,
  pending,
  onConfirm,
  onOpenChange,
}: {
  name: string
  detail: string
  pending: boolean
  onConfirm: () => void
  onOpenChange: (next: boolean) => void
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {name}?</DialogTitle>
          <DialogDescription>{detail}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="outline">Cancel</Button>} />
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The row action buttons every list here shares. */
function RowActions({
  name,
  onView,
  onEdit,
  onDelete,
}: {
  name: string
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {onView && (
        <Button
          size="icon-sm"
          variant="ghost"
          title={`View ${name}`}
          aria-label={`View ${name}`}
          className="text-muted-foreground hover:text-foreground"
          onClick={onView}
        >
          <EyeIcon className="size-3.5" />
        </Button>
      )}
      {onEdit && (
        <Button
          size="icon-sm"
          variant="ghost"
          title={`Edit ${name}`}
          aria-label={`Edit ${name}`}
          className="text-muted-foreground hover:text-foreground"
          onClick={onEdit}
        >
          <PencilIcon className="size-3.5" />
        </Button>
      )}
      {onDelete && (
        <Button
          size="icon-sm"
          variant="ghost"
          title={`Delete ${name}`}
          aria-label={`Delete ${name}`}
          className="text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

/**
 * The Add buttons, each owning its own dialog, so they can sit in the page
 * header beside the title rather than in a second strip inside the content.
 */
export function AddDepartmentButton() {
  const [open, setOpen] = useState(false)
  const canCreate = usePermission(PERMISSIONS.departmentsCreate)

  if (!canCreate) return null

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Add department
      </Button>
      {open && <DepartmentDialog key="new" open onOpenChange={setOpen} />}
    </>
  )
}

export function AddJobTitleButton() {
  const [open, setOpen] = useState(false)
  const canCreate = usePermission(PERMISSIONS.designationsCreate)

  if (!canCreate) return null

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Add job title
      </Button>
      {open && <JobTitleDialog onOpenChange={setOpen} />}
    </>
  )
}

export function AddEmploymentTypeButton() {
  const [open, setOpen] = useState(false)
  const canCreate = usePermission(PERMISSIONS.employmentTypesCreate)

  if (!canCreate) return null

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        <PlusIcon /> Add employee type
      </Button>
      {open && <EmploymentTypeDialog onOpenChange={setOpen} />}
    </>
  )
}

/**
 * Departments — one list with View, Edit and Delete on every row, each shown
 * only to somebody who holds the permission behind it. Ticking rows offers a
 * bulk delete.
 */
export function DepartmentsManager() {
  // `editing === undefined` means closed; null means "new".
  const [editing, setEditing] = useState<Department | null | undefined>(undefined)
  const [viewing, setViewing] = useState<Department | null>(null)
  const [deleting, setDeleting] = useState<Department | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const canUpdate = usePermission(PERMISSIONS.departmentsUpdate)
  const canDelete = usePermission(PERMISSIONS.departmentsDelete)
  const { data: departments, isLoading } = useDepartments()

  return (
    <div className="grid gap-4">
      <Card>
        <CardContent className="grid gap-3 pt-6">
          <p className="text-sm text-muted-foreground">
            {departments?.length ?? 0} total departments
          </p>
          {canDelete && departments && departments.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Not wrapped in a <label>: an ancestor label contributes to
                  the accessible name of the control inside it. */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={selected.size > 0 && selected.size === departments.length}
                  onCheckedChange={(next) =>
                    setSelected(next === true ? new Set(departments.map((d) => d.id)) : new Set())
                  }
                  aria-label="Select all departments"
                />
                <span aria-hidden>Select all</span>
              </div>
              {selected.size > 0 && (
                <Button size="sm" variant="destructive" onClick={() => setBulkDeleting(true)}>
                  <Trash2Icon className="size-3.5" />
                  Delete selected ({selected.size})
                </Button>
              )}
            </div>
          )}

          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !departments?.length ? (
            <p className="text-sm text-muted-foreground">No departments yet.</p>
          ) : (
            <div className="grid gap-2">
              {departments.map((d) => (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {canDelete && (
                      <Checkbox
                        checked={selected.has(d.id)}
                        aria-label={`Select ${d.name}`}
                        onCheckedChange={(next) =>
                          setSelected((prev) => {
                            const copy = new Set(prev)
                            if (next === true) copy.add(d.id)
                            else copy.delete(d.id)
                            return copy
                          })
                        }
                      />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{d.name}</p>
                      {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                      <p className="text-xs text-muted-foreground">
                        {d.employeeCount} {d.employeeCount === 1 ? "employee" : "employees"}
                      </p>
                    </div>
                  </div>
                  <RowActions
                    name={d.name}
                    onView={() => setViewing(d)}
                    onEdit={canUpdate ? () => setEditing(d) : undefined}
                    onDelete={canDelete ? () => setDeleting(d) : undefined}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {editing !== undefined && (
        <DepartmentDialog
          key={editing?.id ?? "new"}
          department={editing ?? undefined}
          open
          onOpenChange={(next) => !next && setEditing(undefined)}
        />
      )}
      {viewing && (
        <DepartmentDetailDialog department={viewing} onOpenChange={(next) => !next && setViewing(null)} />
      )}
      {deleting && (
        <DeleteDepartmentDialog department={deleting} onOpenChange={(next) => !next && setDeleting(null)} />
      )}
      {bulkDeleting && (
        <BulkDeleteDepartmentsDialog
          departments={(departments ?? []).filter((d) => selected.has(d.id))}
          onOpenChange={(next) => !next && setBulkDeleting(false)}
          onDone={() => {
            setBulkDeleting(false)
            setSelected(new Set())
          }}
        />
      )}
    </div>
  )
}

/** Job titles (designations) — list, edit and delete. */
export function JobTitlesManager() {
  const [editing, setEditing] = useState<Designation | null>(null)
  const [deleting, setDeleting] = useState<Designation | null>(null)

  const canUpdate = usePermission(PERMISSIONS.designationsUpdate)
  const canDelete = usePermission(PERMISSIONS.designationsDelete)
  const { data: designations, isLoading } = useDesignations()
  const { data: departments } = useDepartments()
  const remove = useDeleteDesignation()

  const departmentName = new Map((departments ?? []).map((d) => [String(d.id), d.name]))

  return (
    <Card>
      <CardContent className="grid gap-3 pt-6">
        <p className="text-sm text-muted-foreground">{designations?.length ?? 0} total job titles</p>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !designations?.length ? (
          <p className="text-sm text-muted-foreground">No job titles yet.</p>
        ) : (
          <div className="grid gap-2">
            {designations.map((d) => {
              const department = d.departmentId != null ? departmentName.get(String(d.departmentId)) : undefined
              return (
                <div key={d.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {department ? `Department: ${department}` : "No department"}
                    </p>
                  </div>
                  <RowActions
                    name={d.title}
                    onEdit={canUpdate ? () => setEditing(d) : undefined}
                    onDelete={canDelete ? () => setDeleting(d) : undefined}
                  />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>

      {editing && <JobTitleDialog key={editing.id} designation={editing} onOpenChange={(next) => !next && setEditing(null)} />}
      {deleting && (
        <ConfirmDeleteDialog
          name={deleting.title}
          detail="Employees who hold it keep it on their record, but it stops being offered anywhere."
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
          onOpenChange={(next) => !next && setDeleting(null)}
        />
      )}
    </Card>
  )
}

/** Employee types (Full-time, Contract, …) — list, edit and delete. */
export function EmploymentTypesManager() {
  const [editing, setEditing] = useState<EmploymentType | null>(null)
  const [deleting, setDeleting] = useState<EmploymentType | null>(null)

  const canUpdate = usePermission(PERMISSIONS.employmentTypesUpdate)
  const canDelete = usePermission(PERMISSIONS.employmentTypesDelete)
  const { data: types, isLoading } = useEmploymentTypes()
  const remove = useDeleteEmploymentType()

  return (
    <Card>
      <CardContent className="grid gap-3 pt-6">
        <p className="text-sm text-muted-foreground">{types?.length ?? 0} total employee types</p>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !types?.length ? (
          <p className="text-sm text-muted-foreground">No employee types yet.</p>
        ) : (
          <div className="grid gap-2">
            {types.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                  <p className="text-xs text-muted-foreground">
                    {t.employeeCount} {t.employeeCount === 1 ? "employee" : "employees"}
                  </p>
                </div>
                <RowActions
                  name={t.name}
                  onEdit={canUpdate ? () => setEditing(t) : undefined}
                  onDelete={canDelete ? () => setDeleting(t) : undefined}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {editing && (
        <EmploymentTypeDialog key={editing.id} employmentType={editing} onOpenChange={(next) => !next && setEditing(null)} />
      )}
      {deleting && (
        <ConfirmDeleteDialog
          name={deleting.name}
          detail={
            deleting.employeeCount > 0
              ? `${deleting.employeeCount} ${deleting.employeeCount === 1 ? "employee has" : "employees have"} this type. They keep it on their record, but it stops being offered anywhere.`
              : "It will stop being offered on the employee form."
          }
          pending={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
          onOpenChange={(next) => !next && setDeleting(null)}
        />
      )}
    </Card>
  )
}
