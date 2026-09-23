import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { AppraisalWorkspace } from "@/features/appraisals/components/appraisal-workspace"
import { appraisalsApi } from "@/features/appraisals/api"
import { appraisal } from "@/features/appraisals/__tests__/fixtures"
import type { AppraisalDetail } from "@/types/appraisals"

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/appraisals/api", () => ({
  appraisalsApi: {
    saveDraft: vi.fn(),
    submitSelf: vi.fn(),
    submitReview: vi.fn(),
    importPreview: vi.fn(),
    exportUrl: () => "/export",
  },
}))

// Only the panels BELOW the form live in the URL; the form's own position is a
// step, held in state and persisted with the draft.
const push = vi.fn()
let params = new URLSearchParams()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  useSearchParams: () => params,
}))

function renderWorkspace(detail: AppraisalDetail = appraisal()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AppraisalWorkspace appraisal={detail} />
    </QueryClientProvider>
  )
}

/** The form's step buttons, in order. */
const stepLabels = () =>
  Array.from(document.querySelectorAll("ol > li > button")).map((button) =>
    button.textContent?.trim()
  )

/** The tab strip beneath the form. */
const tabLabels = () =>
  Array.from(
    screen.getByRole("navigation", { name: "Appraisal sections" }).querySelectorAll("button")
  ).map((button) => button.textContent?.trim())

const nextStep = () => screen.getByRole("button", { name: /continue to next step/i })

/** Rate the first performance area. Areas are an accordion; the first is open. */
async function rate(user: ReturnType<typeof userEvent.setup>, rating: number) {
  const group = screen.getAllByRole("radiogroup")[0]
  await user.click(within(group).getByRole("radio", { name: new RegExp(`^${rating} —`) }))
}

beforeEach(() => {
  push.mockReset()
  params = new URLSearchParams()
  vi.mocked(appraisalsApi.saveDraft).mockReset().mockResolvedValue(appraisal())
  vi.mocked(appraisalsApi.submitSelf).mockReset().mockResolvedValue(appraisal())
})

describe("the form is a stepper", () => {
  it("walks the appraisal one step at a time", () => {
    renderWorkspace()

    // No Perspective step: the fixture's viewer is the appraisal's subject,
    // and the perspectives are the reviewer's to rate.
    expect(stepLabels()).toEqual([
      "1Performance areasRate and add your feedback",
      "2Your Year in Your WordsOverall comments",
      "3Looking AheadFuture focus",
      "4Review & submitCheck and submit",
    ])
  })

  it("opens on the first step and shows only that step", () => {
    renderWorkspace()

    expect(screen.getByRole("heading", { name: "Performance areas" })).toBeInTheDocument()
    expect(screen.queryByLabelText("Overall summary")).not.toBeInTheDocument()
  })

  it("moves on with Continue and saves the step it leaves", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(nextStep())

    expect(screen.getByLabelText("Overall summary")).toBeInTheDocument()
    expect(vi.mocked(appraisalsApi.saveDraft)).toHaveBeenCalled()
  })

  it("keeps the perspectives away from the appraisal's subject", () => {
    renderWorkspace()

    expect(stepLabels().join(" ")).not.toContain("Perspective")
  })

  it("gives the perspectives step to the reviewer", () => {
    renderWorkspace(
      appraisal({
        viewer: { ...appraisal().viewer, isSubject: false, canSubmitSelf: false, canSubmitReview: true },
      } as never)
    )

    expect(stepLabels().join(" ")).toContain("Perspective")
  })

  it("goes back to an earlier step, keeping what was entered", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await rate(user, 5)

    await user.click(nextStep())
    await user.click(screen.getByRole("button", { name: /^back$/i }))

    const group = screen.getAllByRole("radiogroup")[0]
    expect(within(group).getByRole("radio", { name: /^5 —/ })).toHaveAttribute("aria-checked", "true")
  })

  it("refuses to jump to a step that hasn't been reached", () => {
    renderWorkspace()

    expect(screen.getByRole("button", { name: /Review & submit/ })).toBeDisabled()
  })

  it("carries the ratings into the draft it saves", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await rate(user, 4)

    await user.click(screen.getByRole("button", { name: /save draft/i }))

    const payload = vi.mocked(appraisalsApi.saveDraft).mock.calls.at(-1)![1] as {
      answers: { rating: number }[]
    }
    expect(payload.answers).toHaveLength(1)
    expect(payload.answers[0].rating).toBe(4)
  })

  it("shows the running summary beside the form", () => {
    renderWorkspace()

    expect(screen.getByText("Your progress")).toBeInTheDocument()
    expect(screen.getByText("Selected ratings")).toBeInTheDocument()
    expect(screen.getByText("Estimated overall score")).toBeInTheDocument()
    // The rating guide is the standing reference now; the tips block is gone.
    expect(screen.getByText("Rating guide")).toBeInTheDocument()
    expect(screen.queryByText("Tips for a great appraisal")).not.toBeInTheDocument()
  })

  it("shows a save state in the header", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    expect(screen.getByText(/nothing saved yet/i)).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /save draft/i }))
    expect(await screen.findByText(/^Saved /)).toBeInTheDocument()
  })
})

describe("performance areas", () => {
  it("lists every configured area with its weight and the total", () => {
    renderWorkspace()

    expect(screen.getByRole("button", { name: /Technical Skills & Code Quality/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Business & Client Impact/ })).toBeInTheDocument()
    expect(screen.getByText("Total weight 100%")).toBeInTheDocument()
  })
})

describe("template-driven steps", () => {
  const imported = (sections: unknown[]) =>
    appraisal({
      template: { ...appraisal().template, structure: { wizardSections: sections } },
    } as never)

  const DEV = {
    key: "development",
    kind: "long_text",
    title: "Development & Career Discussion",
    fields: [
      { key: "key_strengths", label: "Key Strengths" },
      { key: "areas_for_improvement", label: "Areas for Improvement" },
    ],
  }

  it("names the step from the workbook rather than from the frontend", () => {
    renderWorkspace(imported([DEV]))

    expect(stepLabels().join(" ")).toContain("Development & Career Discussion")
    expect(stepLabels().join(" ")).not.toContain("Your Year in Your Words")
  })

  it("renders the workbook's prompts and nothing the template does not define", async () => {
    const user = userEvent.setup()
    renderWorkspace(imported([DEV]))
    await user.click(nextStep()) // the workbook's section

    expect(screen.getByLabelText("Key Strengths")).toBeInTheDocument()
    expect(screen.getByLabelText("Areas for Improvement")).toBeInTheDocument()
    // A built-in field the template never mentions is not rendered.
    expect(screen.queryByLabelText("Overall summary")).not.toBeInTheDocument()
  })

  it("follows a renamed prompt with no code change here", async () => {
    const user = userEvent.setup()
    renderWorkspace(
      imported([{ ...DEV, fields: [{ key: "signature_strengths", label: "Signature Strengths" }] }])
    )
    await user.click(nextStep())

    expect(screen.getByLabelText("Signature Strengths")).toBeInTheDocument()
    expect(screen.queryByLabelText("Key Strengths")).not.toBeInTheDocument()
  })

  it("saves a workbook field under its own key", async () => {
    const user = userEvent.setup()
    renderWorkspace(imported([DEV]))
    await user.click(nextStep())

    await user.type(screen.getByLabelText("Key Strengths"), "Deep focus")
    await user.click(screen.getByRole("button", { name: /save draft/i }))

    const payload = vi.mocked(appraisalsApi.saveDraft).mock.calls.at(-1)![1] as {
      responses: Record<string, string>
    }
    expect(payload.responses).toEqual({ key_strengths: "Deep focus" })
  })

  it("falls back to the built-in narrative fields for a hand-built template", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await user.click(nextStep())

    expect(screen.getByLabelText("Overall summary")).toBeInTheDocument()
  })

  it("shows the template's perspectives with their weights and focus", async () => {
    const user = userEvent.setup()
    renderWorkspace(
      appraisal({
        viewer: { ...appraisal().viewer, isSubject: false, canSubmitSelf: false, canSubmitReview: true },
        template: {
          ...appraisal().template,
          structure: {
            perspectives: [
              { name: "Past Performance", weight: 60, assessmentFocus: "What was delivered" },
            ],
          },
        },
      } as never)
    )
    await user.click(nextStep())

    expect(screen.getByText("Past Performance")).toBeInTheDocument()
    expect(screen.getByText("What was delivered")).toBeInTheDocument()
  })
})

describe("review & submit", () => {
  async function goToReview(user: ReturnType<typeof userEvent.setup>) {
    // areas → words → ahead → review
    for (let i = 0; i < 3; i++) await user.click(nextStep())
  }

  it("names what is still outstanding and offers a way back to fix it", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await goToReview(user)

    expect(screen.getByText(/still to finish/i)).toBeInTheDocument()
    const items = Array.from(document.querySelectorAll("li")).map((li) => li.textContent)
    expect(items.some((text) => text?.includes("not rated"))).toBe(true)
    expect(screen.getByRole("button", { name: /fix in performance areas/i })).toBeInTheDocument()
  })

  it("refuses to submit while a required rating is missing", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await goToReview(user)

    expect(screen.getByRole("button", { name: /submit self-appraisal/i })).toBeDisabled()
  })

  it("jumps back to the step that needs fixing", async () => {
    const user = userEvent.setup()
    renderWorkspace()
    await goToReview(user)

    await user.click(screen.getByRole("button", { name: /fix in performance areas/i }))

    expect(screen.getByRole("heading", { name: "Performance areas" })).toBeInTheDocument()
  })
})

describe("the panels beneath the form", () => {
  it("stays a tab strip, since those are equal doors rather than steps", () => {
    // The fixture's viewer is the appraisal's own subject, so the management
    // panels are withheld — see the dedicated test below.
    renderWorkspace()

    expect(tabLabels()).toEqual([
      "Self-appraisal",
      "Version history",
      "Comments",
      "Additional feedback",
      "Deadlines",
    ])
  })

  it("gives an administrator the workflow and reviewer panels too", () => {
    renderWorkspace(
      appraisal({
        viewer: {
          ...appraisal().viewer,
          isSubject: false,
          isAdministrator: true,
          canSubmitSelf: false,
          canSubmitReview: false,
        },
      } as never)
    )

    // Not an editor here, so there is no form tab to lead with.
    expect(tabLabels()).toEqual([
      "Version history",
      "Comments",
      "Additional feedback",
      "Workflow",
      "Reviewers",
      "Deadlines",
    ])
  })

  it("puts the selected panel in the URL so a refresh comes back to it", async () => {
    const user = userEvent.setup()
    renderWorkspace()

    await user.click(screen.getByRole("button", { name: /Comments$/ }))

    expect(push).toHaveBeenCalledWith("?tab=comments", { scroll: false })
  })

  it("reads the panel back out of the URL on mount", () => {
    params = new URLSearchParams("tab=deadlines")
    renderWorkspace()

    expect(screen.getByText("Primary review")).toBeInTheDocument()
    expect(screen.getByText("Finalization")).toBeInTheDocument()
  })

  it("withholds Compensation from someone who cannot manage it", () => {
    renderWorkspace()

    expect(tabLabels()).not.toContain("Compensation & promotion")
  })

  it("offers Compensation to an authorized holder", () => {
    renderWorkspace(
      appraisal({ viewer: { ...appraisal().viewer, canManageCompensation: true } } as never)
    )

    expect(tabLabels()).toContain("Compensation & promotion")
  })

  // The routing timeline, the reviewer chain and calibration are the
  // management apparatus around the appraisal, not the employee's own record.
  it("withholds Workflow and Reviewers from the appraisal's subject", () => {
    renderWorkspace(
      appraisal({ viewer: { ...appraisal().viewer, isSubject: true, isAdministrator: false } } as never)
    )

    expect(tabLabels()).not.toContain("Workflow")
    expect(tabLabels()).not.toContain("Reviewers")
    expect(tabLabels()).toContain("Version history")
    expect(tabLabels()).toContain("Deadlines")
  })
})
