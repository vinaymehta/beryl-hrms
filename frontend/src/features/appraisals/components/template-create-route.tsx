"use client"

import { useSearchParams } from "next/navigation"

import { TemplateBuilderPage } from "@/features/appraisals/components/template-builder"

/**
 * Reads `?source=<id>` and `?edit=<id>` off the URL. Split out of the page so
 * the search-param read sits inside the page's Suspense boundary —
 * useSearchParams opts the tree above it into client-side rendering otherwise.
 *
 * Two different intentions, deliberately two different params: `source` opens
 * the builder pre-filled to create the NEXT VERSION and leaves the original
 * alone, `edit` opens a draft to be replaced in place.
 */
export function TemplateCreateRoute() {
  const params = useSearchParams()
  return (
    <TemplateBuilderPage
      sourceId={params.get("source") ?? undefined}
      editId={params.get("edit") ?? undefined}
    />
  )
}
