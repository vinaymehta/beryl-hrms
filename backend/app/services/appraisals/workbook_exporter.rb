module Appraisals
  # Generates the appraisal workbook an employee downloads (scope §10.1).
  #
  # One sheet for every step the employee fills in, in form order: a title
  # block (who, which cycle, how to fill it), the column headings, then a
  # coloured banner per step —
  #   Step 1 — one row per performance-area question (rating + comments);
  #   each later step (Development & Career, Final Review…) — one row per
  #   written question, answered in the last column.
  # Column A holds the question id / field key the importer matches on; it is
  # hidden. Banner and title rows have no id, so the importer skips them.
  # Plus "_meta" — appraisal_id / employee_id / cycle_id / template_version,
  # HIDDEN and on a locked sheet.
  #
  # A manager (or Admin/HR at the Final review) gets the same file for THEIR
  # form (reviewer: true): each question also shows the employee's own rating
  # and comments, read-only, beside empty cells for theirs, and the written
  # questions are the reviewer's. Uploading it fills their review form.
  #
  # The answer cells are unlocked; everything else is locked on a protected
  # sheet, so the file can be filled in but a row can't be detached from its
  # question.
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
    # The second sheet an earlier version of this download had; still read on
    # upload (SelfAppraisalImport#parse_written_answers).
    WRITTEN_SHEET = "Written answers".freeze
    # Column A (the id the importer matches on) is hidden; B–E are what the
    # employee reads and fills.
    HEADERS = [ "Question ID", "Question", "What is evaluated", "Rating (1–5)", "Comments / Evidence / Answer" ].freeze
    # The employee's columns come BEFORE the reviewer's own: the importer reads
    # the last "rating" / "comment" column, so theirs are what gets filled in.
    REVIEW_HEADERS = [
      "Question ID", "Question", "What is evaluated", "Employee's rating", "Employee's comments",
      "Your rating (1–5)", "Your comments / Answer"
    ].freeze
    NARRATIVE_COLUMNS = %w[summary achievements strengths improvement_areas training_needs next_period_goals].freeze
    RATING_CHOICES = (2..10).map { |half| (half / 2.0).then { |r| r == r.to_i ? r.to_i : r } }.freeze

    def self.call(...) = new(...).call

    def initialize(appraisal:, reviewer: false)
      @appraisal = appraisal
      @reviewer = reviewer
    end

    def filename
      code = @appraisal.employee.employee_code.to_s.parameterize.presence || @appraisal.employee_id
      "#{@reviewer ? 'appraisal-review' : 'self-appraisal'}-#{code}-#{@appraisal.appraisal_cycle.name.parameterize}.xlsx"
    end

    def call
      package = Axlsx::Package.new
      package.use_shared_strings = true
      workbook = package.workbook
      styles = build_styles(workbook)

      workbook.add_worksheet(name: SHEET) do |sheet|
        add_title_block(sheet, styles)
        sheet.add_row(headers, style: styles[:header], height: 24)
        header_row = sheet.rows.size
        rating_rows = []

        add_step_banner(sheet, styles, "Step 1 · Performance areas")
        template.categories.each do |category|
          category.questions.each do |question|
            prompt = question.prompt == category.name ? category.name : "#{category.name} — #{question.prompt}"
            sheet.add_row(
              [ question.id, prompt, question.description, *employee_answer(question.id), nil, nil ],
              style: [ styles[:id], styles[:question], styles[:guidance], *reference_styles(styles), styles[:rating], styles[:answer] ],
              height: 54
            )
            rating_rows << sheet.rows.size
          end
        end

        written_fields.group_by { |field| field[:step] }.each.with_index(2) do |(step, fields), number|
          add_step_banner(sheet, styles, "Step #{number} · #{step}")
          fields.each do |field|
            sheet.add_row(
              [ field[:key], field[:label], "Write your answer in the #{headers.last} column.", *employee_written(field[:key]), "—", nil ],
              style: [ styles[:id], styles[:question], styles[:guidance], *reference_styles(styles), styles[:no_rating], styles[:answer] ],
              height: 72
            )
          end
        end

        if rating_rows.any?
          sheet.add_data_validation(
            "#{rating_column}#{rating_rows.first}:#{rating_column}#{rating_rows.last}",
            type: :list, formula1: %("#{RATING_CHOICES.join(',')}"), allowBlank: true,
            showErrorMessage: true, errorTitle: "Rating", error: "Choose a rating from 1 to 5 (halves like 3.5 allowed).",
            showInputMessage: true, promptTitle: "Rating", prompt: "1 to 5 — halves like 3.5 allowed"
          )
        end

        sheet.column_widths(*(@reviewer ? [ 12, 30, 40, 12, 40, 14, 50 ] : [ 12, 36, 52, 14, 64 ]))
        sheet.column_info.first.hidden = true
        # The headings stay in view while scrolling.
        sheet.sheet_view.pane do |pane|
          pane.top_left_cell = "B#{header_row + 1}"
          pane.state = :frozen
          pane.y_split = header_row
          pane.x_split = 1
          pane.active_pane = :bottom_right
        end
        sheet.page_setup.set(orientation: :landscape, fit_to_width: 1, fit_to_height: 0)
        sheet.print_options.grid_lines = false
        sheet.sheet_protection do |protection|
          protection.password = nil
          protection.format_columns = false
          protection.format_rows = false
        end
      end

      workbook.add_worksheet(name: META_SHEET) do |sheet|
        sheet.add_row [ "key", "value" ], style: styles[:header]
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

    # The template's written questions the EMPLOYEE answers, in wizard order:
    # {key:, step:, label:}. The same rule as the form's (templateFieldAudience):
    # a field's own audience wins; in the Final Review section a field is the
    # employee's when its label names them; elsewhere it is shared unless the
    # section is the reviewer's.
    #
    # For a reviewer, the other side: the fields that aren't the employee's —
    # and at the Final review none of the Final Review block, which Admin/HR
    # read at Discussion rather than answer (the form's narrativeSections).
    def written_fields
      @written_fields ||= wizard_sections.flat_map do |section|
        next [] unless section["kind"] == "long_text"
        next [] if @reviewer && @appraisal.final_review? && section["key"] == "final_review"

        Array(section["fields"]).filter_map do |field|
          next if self.class.field_audience(section, field) == (@reviewer ? "employee" : "reviewer")

          { key: field["key"].to_s, step: section["title"].to_s, label: field["label"].to_s }
        end
      end
    end

    def self.field_audience(section, field)
      if field["audience"].present? then field["audience"]
      elsif section["key"] == "final_review" then field["label"].to_s.match?(/\bemployee\b/i) ? "employee" : "reviewer"
      else section["audience"] == "reviewer" ? "reviewer" : "both"
      end
    end

    private
      INK = "1F2937".freeze
      MUTED = "6B7280".freeze
      LINE = "D1D5DB".freeze
      BRAND = "4F46E5".freeze

      def build_styles(workbook)
        border = { style: :thin, color: LINE }
        cell = ->(**extra) { workbook.styles.add_style({ border: border, font_name: "Calibri", sz: 11, fg_color: INK }.merge(extra)) }
        {
          title: workbook.styles.add_style(b: true, sz: 16, fg_color: INK, font_name: "Calibri"),
          subtitle: workbook.styles.add_style(sz: 11, fg_color: MUTED, font_name: "Calibri"),
          hint: workbook.styles.add_style(sz: 10, i: true, fg_color: MUTED, font_name: "Calibri", alignment: { wrap_text: true }),
          header: cell.call(b: true, bg_color: "F3F4F6", alignment: { vertical: :center, wrap_text: true }),
          banner: workbook.styles.add_style(b: true, sz: 12, fg_color: "FFFFFF", bg_color: BRAND, font_name: "Calibri",
                                            alignment: { vertical: :center, indent: 1 }),
          id: cell.call(fg_color: MUTED, sz: 9, alignment: { vertical: :top }),
          question: cell.call(b: true, alignment: { vertical: :top, wrap_text: true }),
          guidance: cell.call(fg_color: MUTED, sz: 10, alignment: { vertical: :top, wrap_text: true }),
          # The answer cells: unlocked, so they stay editable on the protected sheet.
          rating: cell.call(locked: false, b: true, alignment: { horizontal: :center, vertical: :center }),
          answer: cell.call(locked: false, alignment: { vertical: :top, wrap_text: true }),
          reference: cell.call(fg_color: "374151", sz: 10, bg_color: "F9FAFB", alignment: { vertical: :top, wrap_text: true }),
          reference_rating: cell.call(fg_color: "374151", bg_color: "F9FAFB", alignment: { horizontal: :center, vertical: :center }),
          no_rating: cell.call(bg_color: "F9FAFB", fg_color: "9CA3AF", alignment: { horizontal: :center, vertical: :center })
        }
      end

      def add_title_block(sheet, styles)
        employee = @appraisal.employee
        who = [ employee.full_name, employee.employee_code, employee.designation&.title, employee.department&.name ].compact_blank
        blank = Array.new(headers.size - 2)
        sheet.add_row([ nil, title, *blank ], style: styles[:title], height: 28)
        sheet.add_row([ nil, "#{who.join(' · ')} — #{@appraisal.appraisal_cycle.name}", *blank ], style: styles[:subtitle], height: 18)
        sheet.add_row(
          [ nil, "Fill in the #{headers[-2].sub(' (1–5)', '')} (1 to 5, halves like 3.5 allowed) and #{headers.last} columns, " \
                 "then upload this file back on the appraisal page. The other columns can't be changed.", *blank ],
          style: styles[:hint], height: 30
        )
        sheet.add_row(Array.new(headers.size), height: 8)
        (1..3).each { |row| sheet.merge_cells("B#{row}:#{last_column}#{row}") }
      end

      def add_step_banner(sheet, styles, title)
        sheet.add_row([ nil, title, *Array.new(headers.size - 2) ], style: styles[:banner], height: 24)
        sheet.merge_cells("B#{sheet.rows.size}:#{last_column}#{sheet.rows.size}")
      end

      def headers = @reviewer ? REVIEW_HEADERS : HEADERS
      def last_column = column_letter(headers.size - 1)
      def rating_column = column_letter(headers.size - 2)
      def column_letter(index) = ("A".ord + index).chr

      def title
        return "Self-appraisal" unless @reviewer

        @appraisal.manager_review? ? "Manager review — Level #{@appraisal.review_level}" : "Final review"
      end

      def reference_styles(styles) = @reviewer ? [ styles[:reference_rating], styles[:reference] ] : []

      # The employee's submitted self-appraisal, shown beside a reviewer's cells.
      def employee_answer(question_id)
        return [] unless @reviewer

        answer = employee_answers[question_id]
        [ answer&.rating&.then { |r| r == r.to_i ? r.to_i : r.to_f } || "—", answer&.comment.presence || "—" ]
      end

      def employee_written(key)
        return [] unless @reviewer

        revision = @appraisal.self_appraisal_revision
        value = revision&.responses.to_h[key].presence
        value ||= revision&.public_send(key).presence if NARRATIVE_COLUMNS.include?(key)
        [ "—", value || "—" ]
      end

      def employee_answers
        @employee_answers ||= @appraisal.self_appraisal_revision&.answers.to_a.index_by(&:appraisal_template_question_id)
      end

      def wizard_sections
        structure = template.structure || {}
        Array(structure["wizardSections"] || structure["wizard_sections"])
      end

      # The CYCLE's frozen template, never the newest version.
      def template
        @template ||= @appraisal.appraisal_cycle.appraisal_template
      end
  end
end
