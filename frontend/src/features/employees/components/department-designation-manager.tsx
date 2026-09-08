"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon, Building2Icon, BadgeIcon } from "lucide-react"
import { cn } from "cn"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
import { useCreateDepartment, useCreateDesignation } from "@/features/employees/hooks/use-employee-mutations"
import {
  departmentFormSchema,
  designationFormSchema,
  type DepartmentFormValues,
  type DesignationFormValues,
} from "@/features/employees/schemas"

function DepartmentDialog() {
  const [open, setOpen] = useState(false)
  const create = useCreateDepartment()
  const form = useForm<DepartmentFormValues>({
    resolver: zodResolver(departmentFormSchema),
    defaultValues: { name: "", description: "" },
  })

  function onSubmit(values: DepartmentFormValues) {
    create.mutate(values, {
      onSuccess: () => {
        setOpen(false)
        form.reset()
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}><PlusIcon /> Add department</Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New department</DialogTitle>
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

export function DepartmentDesignationManager() {
  const [activeTab, setActiveTab] = useState<"departments" | "designations">("departments")
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

        <button
          type="button"
          onClick={() => setActiveTab("designations")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            activeTab === "designations"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:border-border hover:text-foreground"
          )}
        >
          <BadgeIcon className="size-4" />
          <span>Designations</span>
          <span
            className={cn(
              "ml-1 rounded-full px-2 py-0.5 text-xs font-semibold",
              activeTab === "designations"
                ? "bg-primary/15 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {designations?.length ?? 0}
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "departments" && (
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2Icon className="size-4 text-role-hr" /> Departments
              </CardTitle>
              <CardDescription>{departments?.length ?? 0} total departments</CardDescription>
            </div>
            <DepartmentDialog />
          </CardHeader>
          <CardContent className="grid gap-2">
            {departmentsLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : !departments?.length ? (
              <p className="text-sm text-muted-foreground">No departments yet.</p>
            ) : (
              departments.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">{d.name}</p>
                    {d.description && <p className="text-xs text-muted-foreground">{d.description}</p>}
                  </div>
                  <Badge variant="outline">{d.status}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
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
