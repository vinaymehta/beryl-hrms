import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { AppraisalComments } from "@/features/appraisals/components/appraisal-comments"
import type { AppraisalDetail } from "@/types/appraisals"

/**
 * The list is filtered server-side (AppraisalCommentPolicy::Scope), so what is
 * asserted here is that the component renders faithfully whatever it is given
 * — and, for the employee, that the form no longer tells them their comment
 * goes somewhere they can't see it.
 */

const mutate = vi.fn()
vi.mock("@/features/appraisals/hooks/use-appraisal-mutations", () => ({
  useAddAppraisalComment: () => ({ mutate, isPending: false }),
}))

function comment(over: Partial<AppraisalDetail["comments"][number]> = {}) {
  return {
    id: "c1",
    body: "A comment",
    visibility: "employee_visible" as const,
    appraisalRevisionId: null,
    authorName: "Pat Primary",
    createdAt: "2026-09-01T10:00:00Z",
    ...over,
  }
}

function detail(over: Partial<AppraisalDetail> = {}) {
  return {
    id: "a1",
    comments: [],
    viewer: { canSetManagementOnlyComment: false },
    ...over,
  } as unknown as AppraisalDetail
}

function renderComments(appraisal: AppraisalDetail) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AppraisalComments appraisal={appraisal} />
    </QueryClientProvider>
  )
}

beforeEach(() => mutate.mockClear())

describe("as the employee", () => {
  const asEmployee = (comments: AppraisalDetail["comments"]) =>
    detail({ comments, viewer: { canSetManagementOnlyComment: false } } as Partial<AppraisalDetail>)

  it("renders an employee-visible comment the server sent through", () => {
    renderComments(asEmployee([comment({ body: "Shared with them" })] as AppraisalDetail["comments"]))

    expect(screen.getByText("Shared with them")).toBeInTheDocument()
    expect(screen.getByText("Employee visible")).toBeInTheDocument()
  })

  it("renders their own comment alongside the reviewer's", () => {
    renderComments(
      asEmployee([
        comment({ id: "c1", body: "Shared with them", authorName: "Pat Primary" }),
        comment({ id: "c2", body: "My own comment", authorName: "Sofia Rivera" }),
      ] as AppraisalDetail["comments"])
    )

    expect(screen.getByText("Shared with them")).toBeInTheDocument()
    expect(screen.getByText("My own comment")).toBeInTheDocument()
  })

  it("shows the empty state when the server sent nothing", () => {
    renderComments(asEmployee([]))

    expect(screen.getByText(/no comments yet/i)).toBeInTheDocument()
  })

  it("tells them their comment is visible to them, not only to management", () => {
    renderComments(asEmployee([]))

    expect(screen.getByText("Your comment is visible to you and to management.")).toBeInTheDocument()
    // The old, misleading copy.
    expect(screen.queryByText("Your comment is visible to management.")).not.toBeInTheDocument()
  })

  it("gives them no way to mark a comment management-only", () => {
    renderComments(asEmployee([]))

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
  })

  it("submits employee_visible", async () => {
    const { container } = renderComments(asEmployee([]))
    const textarea = container.querySelector("textarea")!
    const { fireEvent } = await import("@testing-library/react")

    fireEvent.change(textarea, { target: { value: "Hello" } })
    fireEvent.submit(container.querySelector("form")!)

    expect(mutate).toHaveBeenCalledWith(
      { body: "Hello", visibility: "employee_visible" },
      expect.anything()
    )
  })
})

describe("as a reviewer", () => {
  const asReviewer = (comments: AppraisalDetail["comments"]) =>
    detail({ comments, viewer: { canSetManagementOnlyComment: true } } as Partial<AppraisalDetail>)

  it("renders a management-only comment with its badge", () => {
    renderComments(
      asReviewer([comment({ body: "Internal note", visibility: "management_only" })] as AppraisalDetail["comments"])
    )

    expect(screen.getByText("Internal note")).toBeInTheDocument()
    expect(screen.getByText("Management only")).toBeInTheDocument()
  })

  it("offers the management-only toggle, defaulted on", () => {
    renderComments(asReviewer([]))

    expect(screen.getByRole("checkbox")).toBeInTheDocument()
    expect(screen.queryByText(/visible to you and to management/i)).not.toBeInTheDocument()
  })

  it("submits management_only while the toggle is on", async () => {
    const { container } = renderComments(asReviewer([]))
    const { fireEvent } = await import("@testing-library/react")

    fireEvent.change(container.querySelector("textarea")!, { target: { value: "Internal" } })
    fireEvent.submit(container.querySelector("form")!)

    expect(mutate).toHaveBeenCalledWith(
      { body: "Internal", visibility: "management_only" },
      expect.anything()
    )
  })
})
