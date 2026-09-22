import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { RevisionHistory } from "@/features/appraisals/components/revision-history"
import { appraisal, revision } from "@/features/appraisals/__tests__/fixtures"
import type { AppraisalDetail } from "@/types/appraisals"

/** The chain a Final Reviewer reads: employee V1 → primary V2 → final V3. */
function fullHistory(): AppraisalDetail {
  return appraisal({
    status: "final_review",
    viewer: {
      ...appraisal().viewer,
      isSubject: false,
      level: "final",
      canSubmitSelf: false,
      canSaveSelfDraft: false,
      canSubmitReview: true,
      visibleRevisionStages: ["self_appraisal", "primary_review", "secondary_review", "final_review"],
    },
    transitions: [
      {
        id: "t-1", fromStatus: "self_appraisal_open", toStatus: "primary_review",
        actorName: "Sofia Reyes", notes: null, createdAt: "2026-02-01T09:05:00Z",
      },
      {
        id: "t-2", fromStatus: "primary_review", toStatus: "final_review",
        actorName: "Pat Primary", notes: null, createdAt: "2026-02-10T09:05:00Z",
      },
    ],
    revisions: [
      revision({
        id: "rev-1", versionNumber: 1, label: "V1", stage: "self_appraisal",
        submittedAt: "2026-02-01T09:00:00Z", authorName: "Sofia Reyes", calculatedScore: "4.20",
        summary: "A strong year for delivery.",
        achievements: "Shipped the importer.",
        answers: [
          { id: "a-1", appraisalTemplateQuestionId: "q-1", rating: 5, comment: "Rewrote the parser." },
          { id: "a-2", appraisalTemplateQuestionId: "q-2", rating: 4, comment: "Hit every date." },
        ],
      }),
      revision({
        id: "rev-2", versionNumber: 2, label: "V2", stage: "primary_review",
        submittedAt: "2026-02-10T09:00:00Z", authorName: "Pat Primary", calculatedScore: "3.60",
        summary: "Strong, with room on estimation.",
        answers: [
          { id: "a-3", appraisalTemplateQuestionId: "q-1", rating: 3, comment: "Good, not exceptional." },
          { id: "a-4", appraisalTemplateQuestionId: "q-2", rating: 4, comment: "Agreed." },
        ],
      }),
      revision({
        id: "rev-3", versionNumber: 3, label: "V3", stage: "final_review",
        submittedAt: "2026-02-20T09:00:00Z", authorName: "Fin Final", calculatedScore: "3.80",
        summary: "Calibrated against the wider group.",
        answers: [
          { id: "a-5", appraisalTemplateQuestionId: "q-1", rating: 4, comment: "Calibrated up." },
          { id: "a-6", appraisalTemplateQuestionId: "q-3", rating: 3, comment: "First look at ownership." },
        ],
      }),
    ],
  })
}

/** The only buttons this component renders are the per-version headers. */
function versionHeaders() {
  return screen.getAllByRole("button")
}

/** The newest version starts expanded, so a blind click would collapse it. */
async function openVersion(user: ReturnType<typeof userEvent.setup>, name: RegExp) {
  const header = screen.getByRole("button", { name })
  if (header.getAttribute("aria-expanded") !== "true") await user.click(header)
  return header
}

describe("RevisionHistory", () => {
  it("lists every version as its own record, newest first", () => {
    render(<RevisionHistory appraisal={fullHistory()} />)

    expect(screen.getByText(/3 versions · each one is kept exactly as it was submitted/i)).toBeInTheDocument()
    const headers = versionHeaders()
    expect(headers).toHaveLength(3)
    expect(headers[0]).toHaveTextContent("V3")
    expect(headers[1]).toHaveTextContent("V2")
    expect(headers[2]).toHaveTextContent("V1")
  })

  it("attributes each version to who wrote it, when, and at which stage", () => {
    render(<RevisionHistory appraisal={fullHistory()} />)

    const v1 = screen.getByRole("button", { name: /Sofia Reyes/ })
    expect(v1).toHaveTextContent("Employee self-appraisal")
    // Built from the instant rather than a fixed string: the runner's locale
    // decides the wording, and a version history that showed only a date would
    // be ambiguous for two versions submitted on the same day.
    expect(v1).toHaveTextContent(
      new Date("2026-02-01T09:00:00Z").toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
    )

    expect(screen.getByRole("button", { name: /Pat Primary/ })).toHaveTextContent("Primary manager review")
    expect(screen.getByRole("button", { name: /Fin Final/ })).toHaveTextContent("Final review / calibration")
  })

  it("carries each version's own score and the status it moved into", () => {
    render(<RevisionHistory appraisal={fullHistory()} />)

    expect(screen.getByRole("button", { name: /Sofia Reyes/ })).toHaveTextContent("4.20")
    expect(screen.getByRole("button", { name: /Pat Primary/ })).toHaveTextContent("3.60")
    expect(screen.getByRole("button", { name: /Sofia Reyes/ })).toHaveTextContent("Primary review")
    expect(screen.getByRole("button", { name: /Pat Primary/ })).toHaveTextContent("Final review")
  })

  it("marks the newest version as the current one", () => {
    render(<RevisionHistory appraisal={fullHistory()} />)

    expect(screen.getByRole("button", { name: /Fin Final/ })).toHaveTextContent("Current")
    expect(screen.getByRole("button", { name: /Sofia Reyes/ })).not.toHaveTextContent("Current")
  })

  it("keeps each version's own ratings and comments rather than merging them", async () => {
    const user = userEvent.setup()
    render(<RevisionHistory appraisal={fullHistory()} />)

    await openVersion(user, /Sofia Reyes/)

    expect(screen.getByText("Rewrote the parser.")).toBeInTheDocument()
    expect(screen.getByText("A strong year for delivery.")).toBeInTheDocument()
    // V2's words for the same question are not shown under V1.
    expect(screen.queryByText("Good, not exceptional.")).not.toBeInTheDocument()
  })

  it("shows what a version changed relative to the one before it", async () => {
    const user = userEvent.setup()
    render(<RevisionHistory appraisal={fullHistory()} />)

    await openVersion(user, /Pat Primary/)

    expect(screen.getByText(/compared with V1/i)).toBeInTheDocument()
    // The primary rated question 1 two points lower than the employee did.
    expect(screen.getByText(/-2 from 5/)).toBeInTheDocument()
    expect(screen.getByText(/rewritten in this version/i)).toBeInTheDocument()
    // V1 listed achievements and V2 didn't — silence is reported, not skipped.
    expect(screen.getByText(/Achievements was left blank in this version/i)).toBeInTheDocument()
  })

  it("marks an answer the previous version didn't have as new", async () => {
    const user = userEvent.setup()
    render(<RevisionHistory appraisal={fullHistory()} />)

    await openVersion(user, /Fin Final/)

    // Question 1: the final reviewer calibrated V2's 3 up to a 4.
    expect(screen.getByText(/\+1 from 3/)).toBeInTheDocument()
    // Question 3 was rated here for the first time.
    expect(screen.getByText(/^new$/)).toBeInTheDocument()
  })

  it("says plainly that the first version has nothing to compare against", async () => {
    const user = userEvent.setup()
    render(<RevisionHistory appraisal={fullHistory()} />)

    await openVersion(user, /Sofia Reyes/)

    expect(screen.getByText(/first version — nothing to compare with/i)).toBeInTheDocument()
  })

  describe("what an employee sees before release", () => {
    // The server sends only the stages this viewer may read, so the component
    // is shown one revision — and has to explain the gap rather than let it
    // look like the managers did nothing.
    const beforeRelease = appraisal({
      status: "primary_review",
      revisions: [
        revision({
          id: "rev-1", versionNumber: 1, label: "V1", authorName: "Sofia Reyes",
          answers: [{ id: "a-1", appraisalTemplateQuestionId: "q-1", rating: 5, comment: "Mine." }],
        }),
      ],
    })

    it("shows their own version and explains what is withheld", () => {
      render(<RevisionHistory appraisal={beforeRelease} />)

      expect(screen.getByText(/1 version ·/i)).toBeInTheDocument()
      expect(screen.getByText(/manager reviews stay private until your appraisal is released/i)).toBeInTheDocument()
    })

    it("drops the note once the appraisal has been released", () => {
      render(<RevisionHistory appraisal={{ ...beforeRelease, releasedAt: "2026-03-01T09:00:00Z" }} />)

      expect(screen.queryByText(/stay private until your appraisal is released/i)).not.toBeInTheDocument()
    })
  })

  it("says so when nothing has been submitted at all", () => {
    render(<RevisionHistory appraisal={appraisal()} />)

    expect(screen.getByText(/nothing submitted yet/i)).toBeInTheDocument()
  })

  it("keeps a corrected self-appraisal as an extra version, not a rewrite", async () => {
    const user = userEvent.setup()
    const corrected = appraisal({
      viewer: { ...appraisal().viewer, isSubject: false, level: "final", visibleRevisionStages: ["self_appraisal"] },
      revisions: [
        revision({
          id: "rev-1", versionNumber: 1, label: "V1", authorName: "Sofia Reyes",
          submittedAt: "2026-02-01T09:00:00Z",
          answers: [{ id: "a-1", appraisalTemplateQuestionId: "q-1", rating: 5, comment: "First attempt." }],
        }),
        revision({
          id: "rev-4", versionNumber: 4, label: "V4", authorName: "Sofia Reyes",
          submittedAt: "2026-02-25T09:00:00Z",
          answers: [{ id: "a-7", appraisalTemplateQuestionId: "q-1", rating: 4, comment: "After the correction." }],
        }),
      ],
    })

    render(<RevisionHistory appraisal={corrected} />)

    const headers = versionHeaders()
    expect(headers[0]).toHaveTextContent("V4")
    expect(headers[1]).toHaveTextContent("V1")

    await openVersion(user, /V1/)
    expect(within(headers[1].parentElement as HTMLElement).getByText("First attempt.")).toBeInTheDocument()
  })
})
