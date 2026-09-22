import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { SelfAppraisalWizard } from "@/features/appraisals/components/self-appraisal-wizard"
import { appraisalsApi } from "@/features/appraisals/api"
import { appraisal } from "@/features/appraisals/__tests__/fixtures"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/appraisals/api", () => ({
  appraisalsApi: {
    saveDraft: vi.fn(),
    submitSelf: vi.fn(),
    importPreview: vi.fn(),
    exportUrl: () => "/export",
  },
}))

function renderWizard(detail = appraisal()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SelfAppraisalWizard appraisal={detail} />
    </QueryClientProvider>
  )
}

/** Rate the question in the Nth performance area on step 1. */
async function rate(user: ReturnType<typeof userEvent.setup>, areaIndex: number, rating: number) {
  const groups = screen.getAllByRole("radiogroup")
  await user.click(within(groups[areaIndex]).getByRole("radio", { name: new RegExp(`^${rating} —`) }))
}

describe("SelfAppraisalWizard", () => {
  beforeEach(() => {
    vi.mocked(appraisalsApi.saveDraft).mockReset().mockResolvedValue(appraisal())
    vi.mocked(appraisalsApi.submitSelf).mockReset().mockResolvedValue(appraisal())
  })

  it("starts at step 1 of 5 and names the step", () => {
    renderWizard()

    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument()
    expect(screen.getByText(/step 1 of 5 · performance areas/i)).toBeInTheDocument()
  })

  it("shows the seven configured performance areas with their weights", () => {
    renderWizard()

    expect(screen.getByRole("heading", { name: "Technical Skills & Code Quality" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Business & Client Impact" })).toBeInTheDocument()
    expect(screen.getAllByRole("radiogroup")).toHaveLength(7)
  })

  it("saves a draft on every step it leaves", async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(screen.getByRole("button", { name: /^next$/i }))
    expect(appraisalsApi.saveDraft).toHaveBeenCalledTimes(1)
    expect(vi.mocked(appraisalsApi.saveDraft).mock.calls[0][1]).toMatchObject({ step: 2 })

    await user.click(screen.getByRole("button", { name: /^next$/i }))
    expect(appraisalsApi.saveDraft).toHaveBeenCalledTimes(2)
    expect(vi.mocked(appraisalsApi.saveDraft).mock.calls[1][1]).toMatchObject({ step: 3 })
  })

  it("saves a draft on demand without leaving the step", async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(screen.getByRole("button", { name: /save draft/i }))

    expect(appraisalsApi.saveDraft).toHaveBeenCalledTimes(1)
    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument()
  })

  it("carries the ratings entered on step 1 into the draft it saves", async () => {
    const user = userEvent.setup()
    renderWizard()

    await rate(user, 0, 4)
    await user.click(screen.getByRole("button", { name: /save draft/i }))

    expect(vi.mocked(appraisalsApi.saveDraft).mock.calls[0][1]).toMatchObject({
      answers: [{ questionId: "q-1", rating: 4 }],
    })
  })

  it("presents the three lenses on step 2 with their weights", async () => {
    const user = userEvent.setup()
    renderWizard()

    await user.click(screen.getByRole("button", { name: /^next$/i }))

    expect(screen.getByText(/step 2 of 5 · performance perspectives/i)).toBeInTheDocument()
    // 20 + 20 + 15 + 10 past, 10 + 10 current, 15 future — from the template.
    // This one is deliberately NOT the scope's 60/25/15 default, so the step
    // has to read the template rather than print the standard split.
    expect(screen.getByText(/65% of this appraisal/)).toBeInTheDocument()
    expect(screen.getByText(/standard split is 60%/)).toBeInTheDocument()
    expect(screen.getByText(/^20% of this appraisal/)).toBeInTheDocument()
    expect(screen.getByText(/^15% of this appraisal/)).toBeInTheDocument()
  })

  it("goes back to an earlier step to edit, keeping what was entered", async () => {
    const user = userEvent.setup()
    renderWizard()

    await rate(user, 0, 5)
    await user.click(screen.getByRole("button", { name: /^next$/i }))
    expect(screen.getByText(/step 2 of 5/i)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /^back$/i }))

    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument()
    const groups = screen.getAllByRole("radiogroup")
    expect(within(groups[0]).getByRole("radio", { name: /^5 —/ })).toHaveAttribute("aria-checked", "true")
  })

  it("lets a completed step be jumped to directly, but not one ahead", async () => {
    const user = userEvent.setup()
    renderWizard()

    expect(screen.getByRole("button", { name: /looking ahead/i })).toBeDisabled()

    await user.click(screen.getByRole("button", { name: /^next$/i }))
    await user.click(screen.getByRole("button", { name: /performance areas/i }))

    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument()
  })

  it("reviews everything entered on the final step", async () => {
    const user = userEvent.setup()
    renderWizard()

    await rate(user, 0, 3)
    await user.type(
      screen.getByLabelText(/evidence for: how did you do on technical skills/i),
      "Rewrote the importer."
    )
    await user.click(screen.getByRole("button", { name: /^next$/i })) // lenses
    await user.click(screen.getByRole("button", { name: /^next$/i })) // story
    await user.type(screen.getByLabelText(/overall summary/i), "A solid year.")
    await user.click(screen.getByRole("button", { name: /^next$/i })) // ahead
    await user.click(screen.getByRole("button", { name: /^next$/i })) // review

    expect(screen.getByText(/step 5 of 5 · review & submit/i)).toBeInTheDocument()
    expect(screen.getByText("Rewrote the importer.")).toBeInTheDocument()
    expect(screen.getByText("A solid year.")).toBeInTheDocument()
    // Areas left unrated are called out rather than quietly submitted.
    expect(screen.getByText(/6 questions still unrated/i)).toBeInTheDocument()
  })

  it("jumps back from the review summary to fix an answer", async () => {
    const user = userEvent.setup()
    renderWizard()

    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole("button", { name: /^next$/i }))
    }
    expect(screen.getByText(/step 5 of 5/i)).toBeInTheDocument()

    await user.click(screen.getAllByRole("button", { name: /^edit$/i })[0])

    expect(screen.getByText(/step 1 of 5/i)).toBeInTheDocument()
  })

  it("blocks submission while a rating is missing its evidence", async () => {
    const user = userEvent.setup()
    renderWizard()

    await rate(user, 0, 5) // 5 requires evidence, and none is given
    for (let step = 0; step < 4; step += 1) {
      await user.click(screen.getByRole("button", { name: /^next$/i }))
    }

    expect(screen.getByRole("button", { name: /submit self-appraisal/i })).toBeDisabled()
    expect(screen.getByText(/1 rating needs evidence/i)).toBeInTheDocument()
  })

  it("submits every answer and narrative field in one payload", async () => {
    const user = userEvent.setup()
    renderWizard()

    await rate(user, 0, 3)
    await user.click(screen.getByRole("button", { name: /^next$/i }))
    await user.click(screen.getByRole("button", { name: /^next$/i }))
    await user.type(screen.getByLabelText(/overall summary/i), "A solid year.")
    await user.click(screen.getByRole("button", { name: /^next$/i }))
    await user.type(screen.getByLabelText(/goals for the next period/i), "Lead the migration.")
    await user.click(screen.getByRole("button", { name: /^next$/i }))

    await user.click(screen.getByRole("button", { name: /submit self-appraisal/i }))

    expect(vi.mocked(appraisalsApi.submitSelf).mock.calls[0][1]).toMatchObject({
      answers: [{ questionId: "q-1", rating: 3, comment: "" }],
      summary: "A solid year.",
      nextPeriodGoals: "Lead the migration.",
    })
  })

  it("resumes from the saved draft rather than starting over", () => {
    renderWizard(
      appraisal({
        selfAppraisalDraft: {
          answers: [{ questionId: "q-1", rating: 4, comment: "Picked up where I left off." }],
          narrative: { summary: "Half-written." },
          step: 3,
          savedAt: "2026-02-01T09:00:00Z",
        },
      })
    )

    expect(screen.getByText(/step 3 of 5 · your year in your words/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/overall summary/i)).toHaveValue("Half-written.")
    expect(screen.getByText(/draft saved/i)).toBeInTheDocument()
  })
})
