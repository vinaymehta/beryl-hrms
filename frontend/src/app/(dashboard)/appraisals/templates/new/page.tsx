import { Suspense } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { TemplateCreateRoute } from "@/features/appraisals/components/template-create-route"

/**
 * Creating a template is its own page, not a drawer over the list: it is a long
 * nested document — weighted categories, each with its own questions — and it
 * deserves the full width.
 *
 * `?source=<id>` opens it pre-filled as the next version of an existing
 * template. That lives in the query string rather than in component state so
 * the page can be linked to, reloaded and navigated back to.
 */
export default function NewAppraisalTemplatePage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full rounded-2xl" />}>
      <TemplateCreateRoute />
    </Suspense>
  )
}
