"use client"

import { useSearchParams } from "next/navigation"

import { TemplateBuilderPage } from "@/features/appraisals/components/template-builder"

/**
 * Reads `?source=<id>` off the URL. Split out of the page so the search-param
 * read sits inside the page's Suspense boundary — useSearchParams opts the tree
 * above it into client-side rendering otherwise.
 */
export function TemplateCreateRoute() {
  const sourceId = useSearchParams().get("source") ?? undefined
  return <TemplateBuilderPage sourceId={sourceId} />
}
