module Appraisals
  # The blank workbook an admin downloads before filling in a template offline.
  # Headers come from TemplateImport::HEADERS, so the format the importer reads
  # and the format it hands out can never drift apart.
  class TemplateWorkbook
    def self.call = new.call

    def call
      package = Axlsx::Package.new
      workbook = package.workbook
      header = workbook.styles.add_style(b: true, bg_color: "EEEEEE")
      hint = workbook.styles.add_style(i: true, fg_color: "888888")

      workbook.add_worksheet(name: "Template") do |sheet|
        sheet.add_row(TemplateImport::HEADERS, style: header)
        # One worked row per lens, using the scope's own weighting (§15) so the
        # example already totals sensibly rather than teaching a bad shape.
        sheet.add_row([ "Delivery & Productivity", "Past", 60, "Met agreed commitments",
                        "What was delivered over the period", "Yes", "Yes", "Yes", "Yes" ])
        sheet.add_row([ "Delivery & Productivity", "Past", 60, "Quality of work delivered", nil, "Yes", "Yes", nil, "Yes" ])
        sheet.add_row([ "Capability Today", "Current capability", 25, "Technical / functional skill", nil, "Yes", "Yes", nil, "Yes" ])
        sheet.add_row([ "Readiness", "Future readiness", 15, "Ready for increased responsibility", nil, "Yes", "Yes", nil, "Yes" ])
        sheet.add_row([])
        sheet.add_row([ "Category, Lens and Weight repeat on every row of a category. Weights must total 100%." ], style: hint)

        sheet.column_widths 28, 20, 10, 40, 34, 12, 14, 16, 10
      end

      package.to_stream.read
    end
  end
end
