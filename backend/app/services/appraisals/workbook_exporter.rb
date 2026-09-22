module Appraisals
  # Generates the appraisal workbook an employee downloads (scope §10.1).
  #
  # Two sheets:
  #   "Self Appraisal" — one row per question, the columns the importer reads.
  #   "_meta"          — appraisal_id / employee_id / cycle_id / template_version,
  #                      HIDDEN and on a locked sheet.
  #
  # The metadata is what makes §10.2's "prevent importing another employee's
  # workbook" enforceable: the importer compares it against the appraisal being
  # imported into and refuses a mismatch. Hidden and locked deters casual
  # editing — it is not a security control, and isn't treated as one. The real
  # guard is that the import endpoint is scoped to one appraisal and gated on
  # AppraisalPolicy#submit_self?, so tampering with the sheet can at worst make
  # your own upload fail.
  class WorkbookExporter
    META_SHEET = "_meta".freeze
    SHEET = "Self Appraisal".freeze
    HEADERS = [ "Question ID", "Category", "Question", "Guidance", "Rating (1-5)", "Comments / Evidence" ].freeze

    def self.call(...) = new(...).call

    def initialize(appraisal:)
      @appraisal = appraisal
    end

    def filename
      code = @appraisal.employee.employee_code.to_s.parameterize.presence || @appraisal.employee_id
      "self-appraisal-#{code}-#{@appraisal.appraisal_cycle.name.parameterize}.xlsx"
    end

    def call
      package = Axlsx::Package.new
      workbook = package.workbook

      header_style = workbook.styles.add_style(b: true, bg_color: "EEEEEE", border: { style: :thin, color: "CCCCCC" })
      wrap = workbook.styles.add_style(alignment: { wrap_text: true, vertical: :top })

      workbook.add_worksheet(name: SHEET) do |sheet|
        sheet.add_row(HEADERS, style: header_style)

        template.categories.each do |category|
          category.questions.each do |question|
            sheet.add_row(
              [ question.id, category.name, question.prompt, question.description, nil, nil ],
              style: [ nil, wrap, wrap, wrap, nil, wrap ]
            )
          end
        end

        sheet.column_widths 12, 24, 40, 32, 12, 44
        # Question ID, category and prompt are generated, not answered: locking
        # them keeps a well-meaning edit from detaching a row from its question.
        sheet.sheet_protection do |protection|
          protection.password = nil
          protection.format_columns = false
        end
      end

      workbook.add_worksheet(name: META_SHEET) do |sheet|
        sheet.add_row [ "key", "value" ], style: header_style
        metadata.each { |key, value| sheet.add_row [ key, value.to_s ] }
        sheet.sheet_protection
        sheet.state = :very_hidden
      end

      package.to_stream.read
    end

    def metadata
      {
        "appraisal_id" => @appraisal.id,
        "employee_id" => @appraisal.employee_id,
        "cycle_id" => @appraisal.appraisal_cycle_id,
        "template_id" => template.id,
        "template_version" => template.version
      }
    end

    private
      # The CYCLE's frozen template, never the newest version.
      def template
        @template ||= @appraisal.appraisal_cycle.appraisal_template
      end
  end
end
