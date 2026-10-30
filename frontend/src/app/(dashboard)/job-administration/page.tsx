import { JobOpeningsWorkspace } from "@/features/job-openings/components/job-openings-workspace"

export const metadata = { title: "Job Administration" }

// The openings on the public careers website: create, edit, pause, reorder.
// Gated by job_openings.manage on both sides.
export default function JobAdministrationPage() {
  return <JobOpeningsWorkspace />
}
