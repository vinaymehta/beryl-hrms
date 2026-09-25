import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

/**
 * The AI interview-questions panel.
 *
 * The behaviour worth pinning is the split between reading and generating.
 * Opening the panel must be free — it shows whatever is stored and calls
 * nothing — while generating spends money at a provider and replaces what the
 * last interviewer saw. A panel that quietly regenerated on every open would
 * look identical in a screenshot and be wrong in the bill.
 */

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  generate: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}))

vi.mock("@/features/recruitment/api", () => ({
  recruitmentApi: {
    candidates: {
      interviewQuestions: mocks.fetch,
      generateInterviewQuestions: mocks.generate,
    },
  },
}))

import { InterviewQuestionsDialog } from "@/features/recruitment/components/interview-questions-dialog"
import type { InterviewQuestionSet } from "@/types/recruitment"

const EMPTY: InterviewQuestionSet = { questions: [], generatedAt: null, job: null }

const FILLED: InterviewQuestionSet = {
  generatedAt: "2026-09-24T10:00:00Z",
  job: { id: "j1", title: "Staff Engineer" },
  questions: [
    { area: "experience", question: "Tell me about the billing rewrite.", whyItMatters: "Depth of ownership." },
    { area: "technical", question: "How did you cut p95 latency?", whyItMatters: "Real profiling skill." },
    { area: "role_fit", question: "You haven't led a team — how would you start?", whyItMatters: "Readiness." },
    { area: "behavioural", question: "Describe a disagreement with a reviewer.", whyItMatters: "Collaboration." },
    { area: "closing", question: "What's your notice period?", whyItMatters: "Start date." },
  ],
}

function renderDialog(props: Partial<React.ComponentProps<typeof InterviewQuestionsDialog>> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <InterviewQuestionsDialog
        candidateId="c1"
        candidateName="Priya Raman"
        canGenerate
        open
        onOpenChange={() => {}}
        {...props}
      />
    </QueryClientProvider>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.fetch.mockResolvedValue(EMPTY)
})

describe("opening the panel", () => {
  it("reads what is stored and does not call the AI", async () => {
    renderDialog()

    await waitFor(() => expect(mocks.fetch).toHaveBeenCalledWith("c1"))
    expect(mocks.generate).not.toHaveBeenCalled()
  })

  it("offers to generate when nothing has been written yet", async () => {
    renderDialog()

    expect(await screen.findByText("No questions yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /generate 20 questions/i })).toBeInTheDocument()
  })

  it("shows the stored set, grouped by area", async () => {
    mocks.fetch.mockResolvedValue(FILLED)
    renderDialog()

    expect(await screen.findByText("Tell me about the billing rewrite.")).toBeInTheDocument()
    expect(screen.getByText("Their experience")).toBeInTheDocument()
    expect(screen.getByText("Technical depth")).toBeInTheDocument()
    expect(screen.getByText("Fit for the role")).toBeInTheDocument()
    expect(screen.getByText("Behavioural")).toBeInTheDocument()
    expect(screen.getByText("Closing")).toBeInTheDocument()
  })

  it("shows the interviewer's note under each question", async () => {
    mocks.fetch.mockResolvedValue(FILLED)
    renderDialog()

    expect(await screen.findByText("Depth of ownership.")).toBeInTheDocument()
  })

  it("names the candidate and the role the questions were written for", async () => {
    mocks.fetch.mockResolvedValue(FILLED)
    renderDialog()

    // The description is assembled from several JSX children, so the text is
    // split across nodes — assert on the dialog as a whole.
    await screen.findByText("Tell me about the billing rewrite.")
    const dialog = screen.getByRole("dialog")
    expect(dialog).toHaveTextContent("Priya Raman")
    expect(dialog).toHaveTextContent("Staff Engineer")
  })
})

describe("generating", () => {
  it("calls the AI only when the button is pressed", async () => {
    const user = userEvent.setup()
    mocks.generate.mockResolvedValue(FILLED)
    renderDialog()

    await screen.findByText("No questions yet")
    expect(mocks.generate).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: /generate 20 questions/i }))
    await waitFor(() => expect(mocks.generate).toHaveBeenCalledWith("c1"))
  })

  it("shows the new set without a second fetch", async () => {
    const user = userEvent.setup()
    mocks.generate.mockResolvedValue(FILLED)
    renderDialog()

    await screen.findByText("No questions yet")
    await user.click(screen.getByRole("button", { name: /generate 20 questions/i }))

    expect(await screen.findByText("Tell me about the billing rewrite.")).toBeInTheDocument()
    expect(mocks.fetch).toHaveBeenCalledTimes(1)
  })

  it("offers Regenerate rather than Generate once a set exists", async () => {
    mocks.fetch.mockResolvedValue(FILLED)
    renderDialog()

    expect(await screen.findByRole("button", { name: /regenerate/i })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /generate 20 questions/i })).not.toBeInTheDocument()
  })

  it("says what went wrong instead of showing an empty panel", async () => {
    const user = userEvent.setup()
    mocks.generate.mockRejectedValue(new Error("provider down"))
    renderDialog()

    await screen.findByText("No questions yet")
    await user.click(screen.getByRole("button", { name: /generate 20 questions/i }))

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalled())
  })
})

describe("copying", () => {
  it("copies the questions as plain text with the area headings", async () => {
    // user-event installs its own clipboard on setup, so this reads back what
    // the component actually wrote rather than a stub of our own.
    const user = userEvent.setup()
    mocks.fetch.mockResolvedValue(FILLED)
    renderDialog()

    await user.click(await screen.findByRole("button", { name: /copy all/i }))

    const text = await waitFor(async () => {
      const value = await navigator.clipboard.readText()
      expect(value).not.toBe("")
      return value
    })
    expect(text).toContain("## Their experience")
    expect(text).toContain("1. Tell me about the billing rewrite.")
    expect(text).toContain("## Closing")
  })

  it("offers nothing to copy when there is nothing there" , async () => {
    renderDialog()

    await screen.findByText("No questions yet")
    expect(screen.queryByRole("button", { name: /copy all/i })).not.toBeInTheDocument()
  })
})

describe("someone who may read but not spend", () => {
  it("sees the questions but is offered no way to generate them", async () => {
    mocks.fetch.mockResolvedValue(FILLED)
    renderDialog({ canGenerate: false })

    expect(await screen.findByText("Tell me about the billing rewrite.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /generate|regenerate/i })).not.toBeInTheDocument()
    // Copying what is already there costs nothing, so it stays.
    expect(screen.getByRole("button", { name: /copy all/i })).toBeInTheDocument()
  })
})
