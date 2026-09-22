import { describe, expect, it, vi, beforeEach } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"

import { TemplateBuilderPage } from "@/features/appraisals/components/template-builder"
import { appraisalTemplatesApi } from "@/features/appraisals/api"
import { template } from "@/features/appraisals/__tests__/fixtures"
import type { TemplateImportPreview } from "@/types/appraisals"

const push = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}))

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

vi.mock("@/features/appraisals/api", () => ({
  appraisalTemplatesApi: {
    get: vi.fn(),
    create: vi.fn(),
    importPreview: vi.fn(),
    importFormatUrl: () => "/api/v1/appraisal_templates/import_format",
  },
}))

const IMPORTED: TemplateImportPreview = {
  categories: [
    {
      name: "Delivery & Productivity",
      lens: "past",
      weight: 60,
      position: 0,
      questions: [
        {
          prompt: "Met agreed commitments",
          description: "Over the whole period",
          selfRating: true,
          managerRating: true,
          requiresComment: true,
          required: true,
        },
        {
          prompt: "Quality of work delivered",
          description: null,
          selfRating: true,
          managerRating: true,
          requiresComment: false,
          required: true,
        },
      ],
      errors: [],
    },
    {
      name: "Readiness",
      lens: "future_readiness",
      weight: 40,
      position: 1,
      questions: [
        {
          prompt: "Ready for increased responsibility",
          description: null,
          selfRating: true,
          managerRating: true,
          requiresComment: false,
          required: true,
        },
      ],
      errors: [],
    },
  ],
  totalWeight: 100,
  weightsValid: true,
  questionCount: 3,
  errors: [],
}

function renderBuilder(sourceId?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <TemplateBuilderPage sourceId={sourceId} />
    </QueryClientProvider>
  )
}

async function upload(user: ReturnType<typeof userEvent.setup>, name = "template.csv") {
  const file = new File(["Category,Lens,Weight %,Question\n"], name, { type: "text/csv" })
  await user.upload(screen.getByLabelText(/template spreadsheet/i), file)
}

describe("TemplateBuilderPage", () => {
  beforeEach(() => {
    push.mockReset()
    vi.mocked(appraisalTemplatesApi.create).mockReset().mockResolvedValue(template)
    vi.mocked(appraisalTemplatesApi.get).mockReset().mockResolvedValue(template)
    vi.mocked(appraisalTemplatesApi.importPreview).mockReset().mockResolvedValue(IMPORTED)
  })

  it("is a page, not a drawer — nothing here is a dialog", () => {
    renderBuilder()

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(screen.getByRole("heading", { name: /new appraisal template/i })).toBeInTheDocument()
  })

  it("keeps the live 100% weight rule in view", async () => {
    const user = userEvent.setup()
    renderBuilder()

    expect(screen.getByText(/weights total 0\.00%/i)).toBeInTheDocument()
    expect(screen.getByText(/must total exactly 100%/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText(/weight %/i), "100")

    expect(screen.getByText(/weights total 100\.00%/i)).toBeInTheDocument()
    expect(screen.getByText(/ready to activate/i)).toBeInTheDocument()
  })

  it("won't create an active template whose weights fall short", async () => {
    const user = userEvent.setup()
    renderBuilder()

    await user.type(screen.getByLabelText(/template name/i), "FY26")
    await user.type(screen.getByLabelText(/^name$/i), "Delivery")
    await user.type(screen.getByLabelText(/^question$/i), "Met commitments")
    await user.type(screen.getByLabelText(/weight %/i), "60")

    expect(screen.getByRole("button", { name: /create template/i })).toBeDisabled()
  })

  it("creates the template and returns to the templates tab", async () => {
    const user = userEvent.setup()
    renderBuilder()

    await user.type(screen.getByLabelText(/template name/i), "FY26 Review")
    await user.type(screen.getByLabelText(/^name$/i), "Delivery")
    await user.type(screen.getByLabelText(/^question$/i), "Met commitments")
    await user.type(screen.getByLabelText(/weight %/i), "100")

    await user.click(screen.getByRole("button", { name: /create template/i }))

    await waitFor(() => expect(appraisalTemplatesApi.create).toHaveBeenCalled())
    expect(vi.mocked(appraisalTemplatesApi.create).mock.calls[0][0]).toMatchObject({
      name: "FY26 Review",
      status: "active",
      categoriesAttributes: [
        {
          name: "Delivery",
          weight: 100,
          position: 0,
          questionsAttributes: [{ prompt: "Met commitments", position: 0 }],
        },
      ],
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith("/appraisals?tab=templates"))
  })

  describe("importing from a spreadsheet", () => {
    it("previews what was parsed without saving anything", async () => {
      const user = userEvent.setup()
      renderBuilder()

      await upload(user)

      expect(await screen.findByText(/2 categories/i)).toBeInTheDocument()
      expect(screen.getByText(/3 questions/i)).toBeInTheDocument()
      expect(screen.getByText(/100\.00% weighted/i)).toBeInTheDocument()
      expect(screen.getByText(/· Met agreed commitments/)).toBeInTheDocument()
      expect(appraisalTemplatesApi.create).not.toHaveBeenCalled()
    })

    it("loads the reviewed preview into the builder for editing", async () => {
      const user = userEvent.setup()
      renderBuilder()

      await upload(user)
      await user.click(await screen.findByRole("button", { name: /load into builder/i }))

      // The parsed categories are now ordinary editable fields.
      expect(screen.getByDisplayValue("Delivery & Productivity")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Met agreed commitments")).toBeInTheDocument()
      expect(screen.getByDisplayValue("Ready for increased responsibility")).toBeInTheDocument()
      expect(screen.getByText(/weights total 100\.00%/i)).toBeInTheDocument()
    })

    it("can be edited after import, and saves what is on screen", async () => {
      const user = userEvent.setup()
      renderBuilder()

      await upload(user)
      await user.click(await screen.findByRole("button", { name: /load into builder/i }))

      await user.type(screen.getByLabelText(/template name/i), "Imported FY26")
      const firstQuestion = screen.getByDisplayValue("Met agreed commitments")
      await user.clear(firstQuestion)
      await user.type(firstQuestion, "Met every agreed commitment")

      await user.click(screen.getByRole("button", { name: /create template/i }))

      await waitFor(() => expect(appraisalTemplatesApi.create).toHaveBeenCalled())
      const payload = vi.mocked(appraisalTemplatesApi.create).mock.calls[0][0] as {
        categoriesAttributes: { name: string; lens: string; weight: number; questionsAttributes: unknown[] }[]
      }
      expect(payload.categoriesAttributes).toHaveLength(2)
      expect(payload.categoriesAttributes[0]).toMatchObject({ name: "Delivery & Productivity", lens: "past", weight: 60 })
      expect(payload.categoriesAttributes[0].questionsAttributes[0]).toMatchObject({
        prompt: "Met every agreed commitment",
        requiresComment: true,
      })
      expect(payload.categoriesAttributes[1]).toMatchObject({ lens: "future_readiness", weight: 40 })
    })

    it("shows the parse errors instead of pretending the sheet was fine", async () => {
      vi.mocked(appraisalTemplatesApi.importPreview).mockResolvedValue({
        ...IMPORTED,
        totalWeight: 90,
        weightsValid: false,
        errors: ["Row 4: 'Sideways' is not a known lens"],
      })
      const user = userEvent.setup()
      renderBuilder()

      await upload(user)

      expect(await screen.findByText(/is not a known lens/i)).toBeInTheDocument()
      expect(screen.getByText(/90\.00% weighted/i)).toBeInTheDocument()
    })
  })

  describe("as a new version of an existing template", () => {
    it("starts from the source template's questions", async () => {
      renderBuilder("tpl-1")

      expect(
        await screen.findByRole("heading", { name: /new version of FY26 Performance Review/i })
      ).toBeInTheDocument()
      expect(screen.getByDisplayValue("Technical Skills & Code Quality")).toBeInTheDocument()
      expect(screen.getByText(/weights total 100\.00%/i)).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /create new version/i })).toBeInTheDocument()
    })

    it("offers no spreadsheet import — a version starts from what it versions", async () => {
      renderBuilder("tpl-1")

      await screen.findByRole("heading", { name: /new version of/i })
      expect(screen.queryByRole("button", { name: /upload spreadsheet/i })).not.toBeInTheDocument()
    })
  })
})
