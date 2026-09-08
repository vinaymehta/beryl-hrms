export type EmployeeStatus = "active" | "inactive" | "offboarded"

export interface Department {
  id: string
  name: string
  description: string | null
  status: "active" | "archived"
}

export interface Designation {
  id: string
  title: string
  departmentId: string | null
  status: "active" | "archived"
}

export interface Employee {
  id: string
  employeeCode: string
  firstName: string
  lastName: string
  status: EmployeeStatus
  dateOfJoining: string | null
  department: Department | null
  designation: Designation | null
  phone: string | null
  personalEmail: string | null
  dateOfBirth: string | null
  gender: string | null
  addressLine1: string | null
  addressLine2: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  emergencyContactName: string | null
  emergencyContactPhone: string | null
  profilePhotoUrl: string | null
}

export interface EmployeeListParams {
  page?: number
  departmentId?: string
  designationId?: string
  status?: EmployeeStatus
  q?: string
}
