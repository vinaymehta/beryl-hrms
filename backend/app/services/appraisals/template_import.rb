module Appraisals
  # Parses a spreadsheet into an appraisal template (scope §5).
  #
  # Upload → Validate → Parse → PREVIEW → Admin confirms → Save. This persists
  # NOTHING: the parsed structure goes back to the builder, the admin reviews and
  # confirms it there, and the ordinary create endpoint writes it. So every
  # template rule — the 100% weight total, required prompts, the frozen-once-in-use
  # guard — applies exactly as it does to a hand-built template, because it IS one.
  #
  # TWO layouts are understood, detected rather than configured:
  #
  #   FLAT       one row per question, the shape TemplateWorkbook emits:
  #              Category | Lens | Weight % | Question | Guidance |
  #              Self rating | Manager rating | Evidence required | Required
  #
  #   SECTIONED  a real company appraisal workbook, laid out as banner-separated
  #              sections — employee details, the performance areas, a separate
  #              three-perspective block, development & career discussion, the
  #              final review, and a rating guide. See
  #              spec/fixtures/files/Beryl_Systems_Engineering_Appraisal_2026.xlsm.
  #
  # The sectioned reader used to stop at the TOTAL WEIGHT row, so everything
  # below it — the perspectives, the development prompts, the final review and
  # the rating guide — was read past and thrown away. It now reads the whole
  # sheet and reports, in `unmapped_rows`, any row carrying content that no
  # section claimed. That list is the guarantee: if the parser stops
  # understanding part of a workbook, the preview says so rather than quietly
  # dropping it.
  class TemplateImport
    class Error < StandardError; end

    MAX_BYTES = 2.megabytes
    PERMITTED_EXTENSIONS = %w[.xlsx .xlsm .csv].freeze

    HEADERS = [
      "Category", "Lens", "Weight %", "Question", "Guidance",
      "Self rating", "Manager rating", "Evidence required", "Required"
    ].freeze

    # Accepts the stored enum name or the label an admin would actually type.
    LENS_ALIASES = {
      "past" => "past", "past performance" => "past",
      "current" => "current_capability", "current capability" => "current_capability",
      "current_capability" => "current_capability",
      "future" => "future_readiness", "future readiness" => "future_readiness",
      "future_readiness" => "future_readiness"
    }.freeze

    TRUTHY = %w[y yes true 1 required].freeze

    # Banner rows that open a section, matched on the first populated cell of
    # a row.
    #
    # PATTERNS, not exact strings. An exact match meant that a workbook saying
    # "PERFORMANCE PERSPECTIVES" instead of "PERSPECTIVE", or "Development and
    # Career Discussion" instead of "&", was not recognised as sectioned at
    # all — it fell through to the one-row-per-question reader, which finds the
    # seven areas and silently drops every section below them. That is a
    # spelling difference costing the admin most of their document, so the
    # matching is deliberately forgiving.
    SECTION_BANNERS = [
      [ :perspectives, /\APERFORMANCE\s+PERSPECTIVES?\b/ ],
      [ :development, /\ADEVELOPMENT\b/ ],
      [ :final_review, /\AFINAL\s+(REVIEW|ASSESSMENT)\b/ ],
      [ :rating_guide, /\ARATING\s+(GUIDE|SCALE|KEY)\b/ ]
    ].freeze

    # Upcased, "&" spelled out, runs of whitespace collapsed and surrounding
    # punctuation dropped — so "Development & Career Discussion:" and
    # "DEVELOPMENT AND CAREER  DISCUSSION" both land on the same string.
    def self.banner_key(text)
      normalised = text.to_s.upcase.gsub("&", " AND ").gsub(/[^A-Z0-9\s]/, " ").squeeze(" ").strip
      SECTION_BANNERS.find { |(_, pattern)| normalised.match?(pattern) }&.first
    end

    # The employee-detail labels the workbook carries, in the order it lists
    # them. Used to recognise the detail block rather than to demand it: a
    # workbook missing one reports the absence instead of failing.
    EMPLOYEE_FIELD_LABELS = [
      "Employee Name", "Job Title", "Reporting Manager", "Review Date",
      "Employee ID", "Department", "Current Role / Level", "Date of Joining"
    ].freeze

    # A stable identifier for a workbook field, derived from its label.
    #
    # This is what an ANSWER is filed against, so it has to survive everything
    # that isn't a rename: reordering the rows, adding a field above, changing
    # the surrounding section. It deliberately does NOT survive a rename — a
    # relabelled field is a different question, and silently carrying old
    # answers onto it would misattribute them.
    #
    # Public and on the class because SelfAppraisalImport reads a FILLED copy
    # of the same workbook and has to arrive at exactly the same keys to match
    # its values against the template; two copies of this rule that drifted
    # apart would file answers under keys nothing reads.
    def self.field_key(label)
      label.to_s.downcase.gsub(/[^a-z0-9]+/, "_").gsub(/\A_+|_+\z/, "").presence || "field"
    end

    def self.call(...) = new(...).call

    def initialize(file:)
      @file = file
    end

    def call
      validate_file!
      sheet = spreadsheet.sheet(0)
      @rows = (1..sheet.last_row).map { |number| [ number, sheet.row(number) ] }
      # Every row that ends up in some section's output. Whatever is left over
      # and still has content is reported rather than dropped.
      @claimed = Set.new

      sectioned? ? parse_sectioned : parse_flat(sheet)
    end

    private
      def validate_file!
        raise Error, "No file was uploaded" if @file.blank?

        extension = File.extname(@file.original_filename.to_s).downcase
        unless PERMITTED_EXTENSIONS.include?(extension)
          raise Error, "Upload an .xlsx, .xlsm, or .csv file (got #{extension.presence || 'no extension'})"
        end
        raise Error, "That file is larger than #{MAX_BYTES / 1.megabyte}MB" if @file.size.to_i > MAX_BYTES
      end

      def spreadsheet
        ext = File.extname(@file.original_filename.to_s).delete(".")
        ext = "xlsx" if ext.downcase == "xlsm"
        @spreadsheet ||= Roo::Spreadsheet.open(@file.tempfile.path, extension: ext)
      rescue StandardError => e
        raise Error, "That file couldn't be read as a spreadsheet (#{e.class})"
      end

      # --- shared row helpers -------------------------------------------------

      def blank_row?(cells) = cells.nil? || cells.compact.all? { |cell| cell.to_s.strip.empty? }

      def cell(cells, position)
        position.nil? ? nil : cells[position].to_s.strip.presence
      end

      def first_cell(cells) = cells.compact.map { |c| c.to_s.strip }.find(&:present?)

      def claim(*numbers) = numbers.each { |number| @claimed << number }

      # A weight may arrive as 20, "20%" or 0.2 — Excel stores a percent-formatted
      # cell as the fraction. Anything at or below 1 is read as a fraction, which
      # is safe here because a 1% category weight in a 100% total is not a thing
      # anyone writes, and the alternative reading (100% written as 1) is common.
      def normalise_weight(raw)
        text = raw.to_s.delete("%").strip
        return nil if text.blank?

        value = text.to_d.to_f
        value > 0 && value <= 1.0 ? (value * 100).round(2) : value
      end

      def normalise_lens(raw)
        LENS_ALIASES[raw.to_s.strip.downcase.gsub(/\s+/, " ")]
      end

      def field_key(label) = self.class.field_key(label)

      # Whether the row's first column is bold, as the workbook's styles say.
      #
      # Cached per row because Roo rebuilds the style lookup on every call, and
      # nil-on-error because styling is a hint: a file we can't read styles
      # from is read the old way rather than refused.
      def bold_row?(number)
        @bold_rows ||= {}
        return @bold_rows[number] if @bold_rows.key?(number)

        @bold_rows[number] = begin
          spreadsheet.sheet(0).font(number, 1)&.bold?
        rescue StandardError
          nil
        end
      end

      # --- layout detection ---------------------------------------------------

      # A workbook is "sectioned" if it names a section OR simply looks like a
      # full appraisal form. The second half matters: a workbook whose banners
      # are worded unusually still has a Performance Area / What is Evaluated
      # table, and reading it as sectioned means the sections that ARE
      # recognisable still come through instead of all of them being lost.
      def sectioned?
        banner_rows.any? || area_header_row.present?
      end

      def banner_rows
        @banner_rows ||= @rows.filter_map do |(number, cells)|
          # A banner is a heading: one populated cell, on its own row. Without
          # that check, a data row beginning "Development of the team…" would
          # be read as opening a section.
          next unless cells.compact.count { |cell| cell.to_s.strip.present? } == 1

          key = self.class.banner_key(first_cell(cells))
          [ number, key ] if key
        end.to_h
      end

      # The row numbers of a section: everything after its banner up to the next
      # banner (or the end of the sheet).
      def section_range(kind)
        start = banner_rows.key(kind)
        return nil if start.nil?

        following = banner_rows.keys.select { |number| number > start }.min
        ((start + 1)...(following || (@rows.last.first + 1)))
      end

      def rows_in(range)
        return [] if range.nil?

        @rows.select { |(number, _)| range.cover?(number) }
      end

      # === SECTIONED =========================================================

      def parse_sectioned
        categories = parse_area_rows
        perspectives = parse_perspectives
        total = categories.sum { |category| category[:weight].to_d }

        warnings = []

        # Say so when a section is absent. Silence here was the whole problem:
        # a workbook that lost its perspectives looked exactly like one that
        # never had any, and the admin found out only when the appraisal form
        # came up short.
        {
          "performance perspectives" => perspectives,
          "development & career prompts" => parse_labelled_block(:development),
          "final review fields" => parse_final_review,
          "rating guide" => parse_rating_guide
        }.each do |label, rows|
          next if rows.any?

          warnings << "No #{label} were found in this workbook. If it has that section, check the heading " \
                      "above it — the importer looks for a row containing only that heading."
        end

        if categories.any?
          # The scope's lenses are defined by the workbook's own PERFORMANCE
          # PERSPECTIVE block, which does NOT say which of the seven areas
          # belongs to which perspective. Guessing a mapping here would invent
          # a fact the document does not contain, and the guess would then be
          # indistinguishable from something the company actually decided.
          warnings << "This workbook lists the performance perspectives separately and does not map each " \
                      "performance area to one. Assign a perspective to each area before activating the template."
        end

        {
          layout: "sectioned",
          title: meta_line(1),
          subtitle: meta_line(2),
          assessment_period: assessment_period,
          employee_fields: parse_employee_fields,
          categories: categories,
          total_weight: total.to_f,
          # Mirrors AppraisalTemplate's own activation rule so the admin sees
          # the problem in the preview rather than on save.
          weights_valid: total == 100,
          question_count: categories.sum { |category| category[:questions].size },
          totals: parse_totals,
          perspectives: perspectives,
          development_fields: parse_labelled_block(:development),
          final_review_fields: parse_final_review,
          rating_guide: parse_rating_guide,
          notes: parse_notes,
          warnings: warnings,
          errors: categories.flat_map { |category| category[:errors] },
          unmapped_rows: unmapped_rows,
          # The wizard's own running order, derived from the workbook's
          # sections rather than hardcoded in the frontend. Adding, removing or
          # relabelling a section in the spreadsheet changes the steps an
          # employee walks through, with no code change anywhere.
          wizard_sections: wizard_sections(perspectives)
        }
      end

      # One step per section the workbook actually defines, in sheet order.
      #
      # The performance areas and the final review-and-submit step are not
      # listed: the first is the categories/questions the template model
      # already carries, and the last is a summary of what was entered rather
      # than a section of the form. Everything between them comes from here.
      def wizard_sections(perspectives)
        sections = []

        if perspectives.any?
          sections << {
            key: "perspectives",
            kind: "perspectives",
            title: banner_title(:perspectives) || "Performance perspective",
            caption: "Weighted view across the perspectives this template defines",
            fields: perspectives.map do |perspective|
              {
                key: perspective[:key],
                label: perspective[:name],
                description: perspective[:assessment_focus],
                weight: perspective[:weight]
              }
            end
          }
        end

        development = parse_labelled_block(:development)
        if development.any?
          sections << {
            key: "development",
            kind: "long_text",
            title: banner_title(:development) || "Development & career discussion",
            caption: "In your own words",
            fields: development.map { |field| field.slice(:key, :label).merge(input: "textarea") }
          }
        end

        final_review = parse_final_review
        if final_review.any?
          sections << {
            key: "final_review",
            kind: "long_text",
            title: banner_title(:final_review) || "Final review",
            caption: "Completed by the reviewer",
            # Not the employee's to fill in — the workbook puts these under a
            # FINAL REVIEW banner, which is the manager's part of the form.
            audience: "reviewer",
            fields: final_review.map { |field| field.slice(:key, :label).merge(input: "textarea") }
          }
        end

        sections
      end

      # The banner text as the workbook writes it, title-cased for display.
      def banner_title(kind)
        row_number = banner_rows.key(kind)
        return nil if row_number.nil?

        raw = first_cell(@rows.find { |(number, _)| number == row_number }.last)
        raw.to_s.split(/\s+/).map { |word| word.length > 2 ? word.capitalize : word.downcase }.join(" ").upcase_first
      end

      def meta_line(number)
        row = @rows.find { |(n, _)| n == number }
        return nil if row.nil? || blank_row?(row.last)

        claim(number)
        first_cell(row.last)
      end

      def assessment_period
        line = @rows.filter_map { |(_, cells)| first_cell(cells) }.find { |text| text =~ /assessment period/i }
        line&.[](/assessment period:\s*([^|]+)/i, 1)&.strip
      end

      # Employee details sit as label/value pairs running across the row:
      # A="Employee Name" B=value, C="Job Title" D=value, and so on. Read as
      # pairs rather than by fixed coordinates, so a workbook that lays the same
      # labels out differently still comes through.
      def parse_employee_fields
        wanted = EMPLOYEE_FIELD_LABELS.map { |label| label.downcase.gsub(/\s+/, " ") }
        found = []

        @rows.each do |(number, cells)|
          next if blank_row?(cells)
          break if area_header_row && number >= area_header_row

          matched = false
          cells.each_slice(2).with_index do |(label, value), pair|
            text = label.to_s.strip
            next if text.blank?
            next unless wanted.include?(text.downcase.gsub(/\s+/, " "))

            found << { key: field_key(text), label: text, value: value.to_s.strip.presence, row: number, column: pair * 2 }
            matched = true
          end
          claim(number) if matched
        end

        missing = EMPLOYEE_FIELD_LABELS - found.map { |field| field[:label] }
        found.each { |field| field.delete(:column) }
        { fields: found, missing: missing }
      end

      # The header row of the performance-area table — the one naming both the
      # area and what is evaluated.
      def area_header_row
        return @area_header_row if defined?(@area_header_row)

        @area_header_row = @rows.find do |(_, cells)|
          normalised = cells.map { |c| c.to_s.strip.downcase }
          normalised.any? { |h| h.include?("performance area") } &&
            normalised.any? { |h| h.include?("what is evaluated") }
        end&.first
      end

      def area_columns
        return @area_columns if defined?(@area_columns)

        row = @rows.find { |(number, _)| number == area_header_row }
        return @area_columns = nil if row.nil?

        normalised = row.last.map { |c| c.to_s.strip.downcase }
        @area_columns = {
          number: normalised.index { |h| h == "#" },
          name: normalised.index { |h| h.include?("performance area") },
          weight: normalised.index { |h| h.include?("weight") },
          evaluated: normalised.index { |h| h.include?("what is evaluated") },
          self_comments: normalised.index { |h| h.include?("self-comments") || h.include?("self comments") },
          self_rating: normalised.index { |h| h.include?("self rating") },
          manager_comments: normalised.index { |h| h.include?("manager comments") },
          manager_rating: normalised.index { |h| h.include?("manager rating") }
        }
      end

      def parse_area_rows
        return [] if area_header_row.nil?

        index = area_columns
        claim(area_header_row)
        stop = banner_rows.keys.min || (@rows.last.first + 1)
        categories = []

        @rows.each do |(number, cells)|
          next if number <= area_header_row || number >= stop
          next if blank_row?(cells)

          name = cell(cells, index[:name])
          # The totals strip is read by #parse_totals, not here.
          break if first_cell(cells).to_s.downcase.start_with?("total")
          next if name.blank?

          claim(number)
          evaluated = cell(cells, index[:evaluated])
          errors = []
          weight = normalise_weight(cell(cells, index[:weight]))
          errors << "Row #{number}: weight is missing for #{name}" if weight.nil?

          categories << {
            name: name,
            # Deliberately nil — see the warning in #parse_sectioned.
            lens: nil,
            weight: weight || 0.0,
            description: evaluated,
            position: categories.size,
            # The workbook's answer columns. Empty in a blank template, but
            # carried through so a filled-in workbook is not read as empty.
            captures: {
              self_comments: cell(cells, index[:self_comments]),
              self_rating: cell(cells, index[:self_rating]),
              manager_comments: cell(cells, index[:manager_comments]),
              manager_rating: cell(cells, index[:manager_rating])
            },
            # One question per area: in this layout the area IS the thing being
            # rated, and "What is Evaluated" is its guidance rather than a
            # separate question. Kept as a question so the existing
            # template/question model carries it unchanged.
            questions: [ {
              prompt: name,
              description: evaluated,
              self_rating: true,
              manager_rating: true,
              requires_comment: false,
              required: true,
              position: 0
            } ],
            errors: errors
          }
        end

        categories
      end

      def parse_totals
        row = @rows.find { |(_, cells)| first_cell(cells).to_s.downcase.start_with?("total weight") }
        return nil if row.nil?

        claim(row.first)
        values = row.last.map { |c| c.to_s.strip }
        {
          total_weight: normalise_weight(values.find { |v| v.present? && v != "TOTAL WEIGHT" }),
          label: first_cell(row.last),
          overall_score_label: values.find { |v| v.downcase.include?("overall") }
        }
      end

      def parse_perspectives
        rows = rows_in(section_range(:perspectives))
        return [] if rows.empty?

        banner = banner_rows.key(:perspectives)
        claim(banner) if banner

        header = rows.find do |(_, cells)|
          normalised = cells.map { |c| c.to_s.strip.downcase }
          normalised.any? { |h| h == "perspective" } && normalised.any? { |h| h.include?("weight") }
        end
        return [] if header.nil?

        claim(header.first)
        normalised = header.last.map { |c| c.to_s.strip.downcase }
        index = {
          name: normalised.index { |h| h == "perspective" },
          weight: normalised.index { |h| h.include?("weight") },
          focus: normalised.index { |h| h.include?("assessment focus") },
          manager_rating: normalised.index { |h| h.include?("manager rating") },
          manager_summary: normalised.index { |h| h.include?("manager summary") }
        }

        rows.filter_map do |(number, cells)|
          next if number <= header.first || blank_row?(cells)

          name = cell(cells, index[:name])
          next if name.blank?
          # The weighted-score strip under the three rows.
          if name.downcase.include?("weighted score")
            claim(number)
            next
          end

          claim(number)
          {
            key: field_key(name),
            name: name,
            # Here the lens IS named, so it is resolved — unlike the areas above.
            lens: normalise_lens(name),
            weight: normalise_weight(cell(cells, index[:weight])),
            assessment_focus: cell(cells, index[:focus]),
            manager_rating: cell(cells, index[:manager_rating]),
            manager_summary: cell(cells, index[:manager_summary])
          }
        end
      end

      # A block of labelled free-text prompts: the label sits on its own row and
      # the answer space is the rows beneath it, up to the next label.
      #
      # "Which rows are labels" is the whole difficulty, and it only shows up
      # once somebody fills the form in. In a blank workbook the prompts are
      # the only populated rows, so anything with text in it is a prompt. In a
      # completed one the answers are populated too, and reading them the same
      # way turned five prompts into ten — half of them somebody's prose,
      # promoted into the template's structure, with the actual answers
      # attached to nothing.
      #
      # The document already distinguishes them the way documents do: the
      # prompt is bold and the answer underneath is not. That is read here
      # rather than guessed at from length or wording, both of which are
      # properties of what was typed rather than of what the form asks.
      #
      # If nothing in the block is bold — a CSV, or a workbook built without
      # styling — the old reading stands, because then every populated row
      # really is a prompt.
      def parse_labelled_block(kind)
        rows = rows_in(section_range(kind))
        return [] if rows.empty?

        banner = banner_rows.key(kind)
        claim(banner) if banner

        populated = rows.reject { |(_, cells)| blank_row?(cells) }
        headed = populated.any? { |(number, _)| bold_row?(number) }

        fields = []
        populated.each do |(number, cells)|
          label = first_cell(cells)
          next if label.blank?
          # An answer, not a prompt. Left unclaimed here on purpose: the loop
          # below collects it as the value of the prompt above it.
          next if headed && !bold_row?(number)

          claim(number)
          fields << { key: field_key(label), label: label, value: nil, row: number }
        end

        # Anything typed into the rows between one label and the next is that
        # label's answer.
        fields.each_with_index do |field, position|
          upper = fields[position + 1]&.dig(:row) || rows.last.first + 1
          answer = rows.select { |(number, _)| number > field[:row] && number < upper }
                       .reject { |(_, cells)| blank_row?(cells) }
                       .map { |(number, cells)| claim(number); first_cell(cells) }
                       .compact
          field[:value] = answer.join("\n").presence
          field.delete(:row)
        end

        fields
      end

      # The final review is label/value pairs across two columns per pair, the
      # same shape as the employee details at the top.
      def parse_final_review
        rows = rows_in(section_range(:final_review))
        return [] if rows.empty?

        banner = banner_rows.key(:final_review)
        claim(banner) if banner

        fields = []
        rows.each do |(number, cells)|
          next if blank_row?(cells)

          claim(number)
          cells.each_slice(2) do |(label, value)|
            text = label.to_s.strip
            next if text.blank?

            fields << { key: field_key(text), label: text, value: value.to_s.strip.presence }
          end
        end
        fields
      end

      def parse_rating_guide
        rows = rows_in(section_range(:rating_guide))
        return [] if rows.empty?

        banner = banner_rows.key(:rating_guide)
        claim(banner) if banner

        header = rows.find do |(_, cells)|
          normalised = cells.map { |c| c.to_s.strip.downcase }
          normalised.include?("rating") && normalised.include?("level")
        end
        return [] if header.nil?

        claim(header.first)
        normalised = header.last.map { |c| c.to_s.strip.downcase }
        index = {
          rating: normalised.index("rating"),
          level: normalised.index("level"),
          definition: normalised.index("definition")
        }

        rows.filter_map do |(number, cells)|
          next if number <= header.first || blank_row?(cells)

          rating = cell(cells, index[:rating])
          level = cell(cells, index[:level])
          # The rating column must actually hold a number. Without this the
          # calibration sentence at the foot of the sheet — which sits in the
          # same column — was read as a sixth rating of 0 and swallowed the
          # note, so it appeared neither here nor in `notes`.
          next unless rating.to_s.match?(/\A\d+(\.\d+)?\z/)
          next if level.blank?

          claim(number)
          { rating: rating.to_d.to_i, level: level, definition: cell(cells, index[:definition]) }
        end
      end

      # Free-standing guidance lines — the calibration principle at the foot of
      # the sheet. Claimed so they don't show up as unmapped.
      def parse_notes
        @rows.filter_map do |(number, cells)|
          next if @claimed.include?(number) || blank_row?(cells)

          text = first_cell(cells)
          next unless text.to_s.length > 40 && cells.compact.count { |c| c.to_s.strip.present? } == 1

          claim(number)
          text
        end
      end

      # The honesty check: any row with content that no section understood.
      def unmapped_rows
        @rows.filter_map do |(number, cells)|
          next if @claimed.include?(number) || blank_row?(cells)

          { row: number, content: cells.compact.map { |c| c.to_s.strip }.reject(&:blank?).join(" | ") }
        end
      end

      # === FLAT ==============================================================

      def parse_flat(sheet)
        categories = parse_flat_rows(sheet)
        raise Error, "No question rows were found in that file" if categories.empty?

        total = categories.sum { |category| category[:weight].to_d }
        {
          layout: "flat",
          categories: categories,
          total_weight: total.to_f,
          weights_valid: total == 100,
          question_count: categories.sum { |category| category[:questions].size },
          employee_fields: { fields: [], missing: [] },
          perspectives: [],
          development_fields: [],
          final_review_fields: [],
          rating_guide: [],
          notes: [],
          warnings: [],
          errors: categories.flat_map { |category| category[:errors] },
          unmapped_rows: [],
          wizard_sections: []
        }
      end

      def flat_column_index(header)
        normalised = header.map { |cell| cell.to_s.strip.downcase }
        {
          category: normalised.index { |h| h.start_with?("category") || h.include?("performance area") },
          lens: normalised.index { |h| h.start_with?("lens") || h.include?("perspective") },
          weight: normalised.index { |h| h.include?("weight") },
          prompt: normalised.index { |h| h.start_with?("question") || h.include?("prompt") || h.include?("what is evaluated") },
          guidance: normalised.index { |h| h.include?("guidance") || h.include?("description") || h.include?("focus") },
          self_rating: normalised.index { |h| h.include?("self") },
          manager_rating: normalised.index { |h| h.include?("manager") },
          requires_comment: normalised.index { |h| h.include?("evidence") },
          required: normalised.index { |h| h == "required" }
        }
      end

      def parse_flat_rows(sheet)
        header_row = 1
        index = nil

        (1..[ sheet.last_row, 25 ].min).each do |number|
          cells = sheet.row(number)
          next if cells.blank?

          idx = flat_column_index(cells)
          if idx[:category].present? && idx[:prompt].present?
            header_row = number
            index = idx
            break
          end
        end

        if index.nil? || index[:category].nil? || index[:prompt].nil?
          raise Error, "The sheet needs at least a 'Category' and a 'Question' column"
        end

        grouped = {}

        ((header_row + 1)..sheet.last_row).each do |number|
          cells = sheet.row(number)
          next if cells.blank?
          break if cells.compact.any? { |c| c.to_s.strip.downcase.start_with?("total", "performance perspective") }

          name = cell(cells, index[:category])
          prompt = cell(cells, index[:prompt])
          # The unit of import is a QUESTION, so a row without one carries
          # nothing — blank spacer rows and the notes line at the foot of the
          # downloaded format both land here and are skipped rather than
          # becoming a category with a sentence for a name.
          next if prompt.blank? || name.blank?

          category = (grouped[name.downcase] ||= new_flat_category(name, cells, index, number))
          record_conflicts(category, cells, index, number)

          category[:questions] << {
            prompt: prompt,
            description: cell(cells, index[:guidance]),
            self_rating: flag(cells, index[:self_rating], default: true),
            manager_rating: flag(cells, index[:manager_rating], default: true),
            requires_comment: flag(cells, index[:requires_comment], default: false),
            required: flag(cells, index[:required], default: true)
          }
        end

        grouped.values.each_with_index.map { |category, position| category.merge(position: position) }
      end

      def new_flat_category(name, cells, index, row_number)
        errors = []
        errors << "Row #{row_number}: category name is blank" if name.blank?

        raw_lens = cell(cells, index[:lens])
        lens = normalise_lens(raw_lens)
        # No guessing from the category's name: a lens that was never written
        # down is reported as missing, not inferred. See #parse_sectioned.
        errors << "Row #{row_number}: '#{raw_lens}' is not a known lens" if raw_lens.present? && lens.nil?

        raw_weight = cell(cells, index[:weight])
        errors << "Row #{row_number}: weight is missing" if raw_weight.blank?

        {
          name: name,
          lens: lens,
          weight: normalise_weight(raw_weight) || 0.0,
          questions: [],
          errors: errors
        }
      end

      # A category's lens and weight are per-category, but live on every row. If
      # two rows disagree, say so instead of silently taking the first.
      def record_conflicts(category, cells, index, row_number)
        lens = normalise_lens(cell(cells, index[:lens]))
        if lens.present? && lens != category[:lens]
          category[:errors] << "Row #{row_number}: lens '#{lens}' disagrees with '#{category[:lens]}' set earlier for #{category[:name]}"
        end

        raw_weight = cell(cells, index[:weight])
        return if raw_weight.blank?

        weight = normalise_weight(raw_weight)
        return if weight == category[:weight]

        category[:errors] << "Row #{row_number}: weight #{raw_weight} disagrees with #{category[:weight]} set earlier for #{category[:name]}"
      end

      # A blank cell means "use the sensible default", not "false" — an admin
      # who leaves the flag columns empty expects the ordinary behaviour.
      def flag(cells, position, default:)
        raw = cell(cells, position)
        return default if raw.nil?

        TRUTHY.include?(raw.downcase)
      end
  end
end
