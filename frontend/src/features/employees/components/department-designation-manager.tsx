"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, Building2Icon, BadgeIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react"
import { cn } from "cn"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { useDepartments, useDesignations } from "@/features/employees/hooks/use-employees"
import {
  useCreateDepartment,
  useUpdateDepartment,
  useDeleteDepartment,
  useCreateDesignation,
} from "@/features/employees/hooks/use-employee-mutations"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { PERMISSIONS } from "@/constants/permissions"
import type { Department } from "@/types/employees"
import {
  departmentFormSchema,
  designationFormSchema,
  type DepartmentFormValues,
  type DesignationFormValues,
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

function DesignationDialog() {
  const [open, setOpen] = useState(false)
  const { data: departments } = useDepartments()
  const create = useCreateDesignation()
  const form = useForm<DesignationFormValues>({
    resolver: zodResolver(designationFormSchema),
    defaultValues: { title: "", departmentId: "" },
  })

  function onSubmit(values: DesignationFormValues) {
    create.mutate(values, {
      onSuccess: () => {
        setOpen(false)
        form.reset()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}><PlusIcon /> Add designation</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New designation</DialogTitle>
          <DialogDescription>Job titles within a department.</DialogDescription>
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
                    value={field.value || undefined}
                    onValueChange={(v) => field.onChange(v ?? undefined)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select department" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {departments?.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Cancel</Button>} />
              <Button type="submit" disabled={create.isPending} onClick={form.handleSubmit(onSubmit)}>
                Create
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * The Add button, owning its own dialog.
 *
 * Separate from the list so it can sit in the page header beside the title,
 * where a primary action belongs, rather than in a second header strip inside
 * the content below it. Nothing is shared between the two, so there is nothing
 * to lift or thread through.
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

/**
 * How the list is being used. Chosen on the All Settings landing screen, from
 * the dropdown under Departments — not here: picking it before you are looking
 * at the list is what keeps the bin away from a stray click while you read.
 */
type DepartmentMode = "view" | "edit" | "delete"

export function DepartmentDesignationManager({ mode: requested }: { mode?: string } = {}) {
  const [activeTab, setActiveTab] = useState<"departments" | "designations">("departments")
  // One at a time: which department is being created/edited, viewed, deleted.
  const [editing, setEditing] = useState<Department | null | undefined>(undefined)
  const [viewing, setViewing] = useState<Department | null>(null)
  const [deleting, setDeleting] = useState<Department | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const canUpdate = usePermission(PERMISSIONS.departmentsUpdate)
  const canDelete = usePermission(PERMISSIONS.departmentsDelete)

  // Chosen on the All Settings landing screen, from the dropdown under
  // Departments. Falls back to View — the harmless one — for anything
  // unrecognised, or for a mode the viewer has no right to: a URL naming
  // "delete" must not hand somebody a bin they were never offered.
  const mode: DepartmentMode =
    requested === "edit" && canUpdate
      ? "edit"
      : requested === "delete" && canDelete
        ? "delete"
        : "view"
  const { data: departments, isLoading: departmentsLoading } = useDepartments()
  const { data: designations, isLoading: designationsLoading } = useDesignations()

  const departmentMap = new Map((departments ?? []).map((d) => [d.id, d.name]))

  return (
    <div className="grid gap-4">
      {/* Tab Navigation */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setActiveTab("departments")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "departments"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          <Building2Icon className="size-4" />
          <span>Departments</span>
          <span
            className={cn(
              "ml-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              activeTab === "departments"
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {departments?.length ?? 0}
          </span>
        </button>

        {/* Designations tab hidden for this rollout — model/API/dialogs
            below stay intact, just unreachable since nothing can set
            activeTab to "designations" anymore. */}
      </div>

      {/* Tab Panels */}
      {activeTab === "departments" && (
        <Card>
          {/* No header of its own: the page above already names this screen,
              and the Add button now sits beside that title. A second heading
              strip here was the thing pushing the primary action down. */}
          <CardContent className="grid gap-3 pt-6">
            <p className="text-sm text-muted-foreground">
              {departments?.length ?? 0} total departments
            </p>
            {/* Only in delete mode, and only once something is ticked. */}
            {mode === "delete" && departments && departments.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                {/* Not wrapped in a <label>: an ancestor label contributes to
                    the accessible name of the control inside it, which would
                    leave this one announced as something other than what
                    aria-label says. */}
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
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={selected.size === 0}
                  onClick={() => setBulkDeleting(true)}
                >
                  <Trash2Icon className="size-3.5" />
                  Delete selected{selected.size > 0 ? ` (${selected.size})` : ""}
                </Button>
              </div>
            )}

            {departmentsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !departments?.length ? (
              <p className="text-sm text-muted-foreground">No departments yet.</p>
            ) : (
              <div className="grid gap-2">
                {departments.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      {mode === "delete" && (
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
                        {d.description && (
                          <p className="text-xs text-muted-foreground">{d.description}</p>
                        )}
                        {/* Headcount rather than a status chip: whether a
                            department is used is the thing anybody actually
                            wants to know from a list of them. */}
                        <p className="text-xs text-muted-foreground">
                          {d.employeeCount} {d.employeeCount === 1 ? "employee" : "employees"}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {mode === "view" && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={`View ${d.name}`}
                          aria-label={`View ${d.name}`}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setViewing(d)}
                        >
                          <EyeIcon className="size-3.5" />
                        </Button>
                      )}
                      {mode === "edit" && canUpdate && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={`Edit ${d.name}`}
                          aria-label={`Edit ${d.name}`}
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => setEditing(d)}
                        >
                          <PencilIcon className="size-3.5" />
                        </Button>
                      )}
                      {mode === "delete" && canDelete && (
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          title={`Delete ${d.name}`}
                          aria-label={`Delete ${d.name}`}
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => setDeleting(d)}
                        >
                          <Trash2Icon className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {/* `editing === undefined` means closed; null means "new". Keyed so the
          form re-initialises with the right values each time it opens. */}
      {editing !== undefined && (
        <DepartmentDialog
          key={editing?.id ?? "new"}
          department={editing ?? undefined}
          open
          onOpenChange={(next) => !next && setEditing(undefined)}
        />
      )}
      {viewing && (
        <DepartmentDetailDialog
          department={viewing}
          onOpenChange={(next) => !next && setViewing(null)}
        />
      )}
      {deleting && (
        <DeleteDepartmentDialog
          department={deleting}
          onOpenChange={(next) => !next && setDeleting(null)}
        />
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

      {activeTab === "designations" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <BadgeIcon className="size-4 text-role-hr" /> Designations
              </CardTitle>
              <CardDescription>{designations?.length ?? 0} total designations</CardDescription>
            </div>
            <DesignationDialog />
          </CardHeader>
          <CardContent className="grid gap-2">
            {designationsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !designations?.length ? (
              <p className="text-sm text-muted-foreground">No designations yet.</p>
            ) : (
              designations.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{d.title}</p>
                    {d.departmentId && departmentMap.get(d.departmentId) && (
                      <p className="text-xs text-muted-foreground">
                        Department: {departmentMap.get(d.departmentId)}
                      </p>
                    )}
                  </div>
                  <Badge variant="outline">{d.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
