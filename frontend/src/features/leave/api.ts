import { apiClient } from "@/lib/api-client"
import type { LeaveRequest } from "@/types/leave"
import type { LeaveRequestValues } from "@/features/leave/schemas"

// Backend has `resources :leaves, only: %i[ index create update ]` — approve
// and reject are both PATCH /leaves/:id with { status: "approved"|"rejected" }.
export const leaveApi = {
  listMine: () => apiClient.get<LeaveRequest[]>("/leaves?mine=true"),
  listPending: () => apiClient.get<LeaveRequest[]>("/leaves?status=pending"),
  create: (values: LeaveRequestValues) => apiClient.post<LeaveRequest>("/leaves", values),
  approve: (id: string) => apiClient.patch<LeaveRequest>(`/leaves/${id}`, { status: "approved" }),
  reject: (id: string, reviewNote: string) =>
    apiClient.patch<LeaveRequest>(`/leaves/${id}`, { status: "rejected" }),
}
