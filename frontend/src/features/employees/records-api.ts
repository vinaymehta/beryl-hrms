import { apiClient } from "@/lib/api-client"
import type {
  EmployeeRecordRow,
  EmployeeRecordResource,
  AppraisalFeedbackRequestRow,
} from "@/types/employee-records"

/**
 * One client for all seven employee record kinds — they share the same nested
 * shape and the same shared backend concern, so seven near-identical API
 * modules would earn nothing.
 */
export const employeeRecordsApi = {
  list: (employeeId: string, resource: EmployeeRecordResource) =>
    apiClient.get<EmployeeRecordRow[]>(`/employees/${employeeId}/${resource}`),
  create: (employeeId: string, resource: EmployeeRecordResource, values: unknown) =>
    apiClient.post<EmployeeRecordRow>(`/employees/${employeeId}/${resource}`, values),
  update: (employeeId: string, resource: EmployeeRecordResource, id: string, values: unknown) =>
    apiClient.patch<EmployeeRecordRow>(`/employees/${employeeId}/${resource}/${id}`, values),
  remove: (employeeId: string, resource: EmployeeRecordResource, id: string) =>
    apiClient.delete<void>(`/employees/${employeeId}/${resource}/${id}`),
  /** §20 — stamps who validated a skill and when. */
  validateSkill: (employeeId: string, id: string) =>
    apiClient.patch<EmployeeRecordRow>(`/employees/${employeeId}/skills/${id}/validate_skill`, {}),
}

/** Optional 360° feedback (§21), nested under the appraisal it belongs to. */
export const appraisalFeedbackApi = {
  list: (appraisalId: string) =>
    apiClient.get<AppraisalFeedbackRequestRow[]>(`/appraisals/${appraisalId}/feedback_requests`),
  create: (appraisalId: string, values: unknown) =>
    apiClient.post<AppraisalFeedbackRequestRow>(`/appraisals/${appraisalId}/feedback_requests`, values),
  respond: (appraisalId: string, id: string, response: string) =>
    apiClient.patch<AppraisalFeedbackRequestRow>(
      `/appraisals/${appraisalId}/feedback_requests/${id}/respond_to_request`,
      { response }
    ),
  remove: (appraisalId: string, id: string) =>
    apiClient.delete<void>(`/appraisals/${appraisalId}/feedback_requests/${id}`),
}
