module Appraisals
  # The scope's Excel workflow:
  #
  #   Upload → Validate → Parse → Preview → Employee Confirms → Save/Submit
  #
  # This class covers Upload/Validate/Parse/Preview ONLY, and deliberately
  # persists nothing. The employee reviews the parsed values in the form and
  # then submits through the ordinary #submit_self path, so:
  #
  #   • the database stays the system of record — a spreadsheet is an input
  #     convenience, never a source of truth;
  #   • every validation, permission check and immutable-revision rule applies
  #     exactly as it does to a typed submission, because it IS one.
  #
  # TWO layouts are accepted, detected rather than configured:
  #
  #   ANSWER SHEET  what #export emits: a header row, then one row per question
  #                 with Question ID | Question | Rating | Comments. The id is
  #                 what binds a row to a question, so a reworded prompt can't
  #                 silently attach an answer to the wrong one.
  #
  #   FULL FORM     a filled-in copy of the company appraisal workbook itself —
  #                 the same .xlsm an Admin imports to define the template, with
  #                 the Self Rating, evidence, development and final-review
  #                 cells typed in. People fill the document they were given
  #                 rather than exporting a fresh answer sheet first, and
  #                 refusing that file for want of a Question ID column simply
  #                 meant their work was retyped by hand.
  #
  # The full-form reader matches by LABEL, because a workbook nobody exported
  # has no ids in it. Labels are normalised through TemplateImport.field_key —
  # the same rule that produced the template's keys in the first place — and a
  # row that matches nothing is reported rather than dropped. Nothing is
  # matched by position: reordering the workbook's sections is not a rename.
  class SelfAppraisalImport
    class Error < StandardError; end

    MAX_BYTES = 2.megabytes
    PERMITTED_EXTENSIONS = %w[.xlsx .xlsm .csv].freeze

    Row = Struct.new(
      :question_id, :prompt, :rating, :comment,
      :self_rating, :self_comment, :manager_rating, :manager_comment,
      :source, :errors,
      keyword_init: true
    ) do
      def valid? = errors.empty?
    end

    def self.call(...) = new(...).call

    def initialize(appraisal:, file:)
      @appraisal = appraisal
      @file = file
    end

    def call
      validate_file!
      validate_workbook_identity!

      answer_sheet? ? import_answer_sheet : import_full_form
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

      # Scope §10.2: "prevent importing another employee's workbook". An exported
      # workbook carries its origin on a hidden sheet; if it is there and it
      # names a different appraisal, the upload is refused outright rather than
      # being silently mapped onto whoever is logged in.
      #
      # A workbook without the sheet (the company form, hand-built, or a CSV) is
      # allowed through — the endpoint is already scoped to one appraisal and
      # gated on AppraisalPolicy#submit_self?, so the metadata is a mis-file
      # guard, not the access control.
      def validate_workbook_identity!
        meta = workbook_metadata
        return if meta.blank?

        if meta["appraisal_id"].present? && meta["appraisal_id"].to_i != @appraisal.id
          raise Error, "That workbook belongs to a different appraisal"
        end
        if meta["employee_id"].present? && meta["employee_id"].to_i != @appraisal.employee_id
          raise Error, "That workbook belongs to a different employee"
        end
        if meta["cycle_id"].present? && meta["cycle_id"].to_i != @appraisal.appraisal_cycle_id
          raise Error, "That workbook is from a different appraisal cycle"
        end
        if meta["template_version"].present? &&
           meta["template_version"].to_i != @appraisal.appraisal_cycle.appraisal_template.version
          raise Error, "That workbook was generated from a different template version"
        end
      end

      def workbook_metadata
        return {} unless spreadsheet.sheets.include?(WorkbookExporter::META_SHEET)

        sheet = spreadsheet.sheet(WorkbookExporter::META_SHEET)
        (2..sheet.last_row).to_h { |row| [ sheet.row(row)[0].to_s, sheet.row(row)[1] ] }
      rescue StandardError
        # A malformed or unreadable meta sheet is treated as absent rather than
        # blocking an otherwise-valid upload.
        {}
      end

      def spreadsheet
        ext = File.extname(@file.original_filename.to_s).delete(".")
        ext = "xlsx" if ext.downcase == "xlsm"
        @spreadsheet ||= Roo::Spreadsheet.open(@file.tempfile.path, extension: ext)
      rescue StandardError => e
        raise Error, "That file couldn't be read as a spreadsheet (#{e.class})"
      end

      # The two layouts are told apart by the one thing only the exported sheet
      # has: a column of question ids. Everything else — headings, column
      # order, which cells are filled — varies between real workbooks.
      def answer_sheet?
        header = spreadsheet.sheet(0).row(1).map { |cell| cell.to_s.strip.downcase }
        header.any? { |h| h.include?("question id") || h == "id" }
      rescue StandardError
        false
      end

      # Questions of the CYCLE's frozen template — a row pointing at a question
      # from some newer template version is rejected, not quietly accepted.
      def questions
        @questions ||= AppraisalTemplateQuestion
          .joins(:appraisal_template_category)
          .where(appraisal_template_categories: { appraisal_template_id: template.id })
          .index_by(&:id)
      end

      def template
        @template ||= @appraisal.appraisal_cycle.appraisal_template
      end

      # === ANSWER SHEET ======================================================

      def import_answer_sheet
        rows = parse_answer_rows
        raise Error, "No question rows were found in that file" if rows.empty?

        summarise(rows, layout: "answer_sheet")
      end

      def parse_answer_rows
        sheet = spreadsheet.sheet(0)
        header = sheet.row(1).map { |cell| cell.to_s.strip.downcase }
        index = {
          question_id: header.index { |h| h.include?("question id") || h == "id" },
          prompt: header.index { |h| h == "question" || h.include?("prompt") },
          rating: header.index { |h| h.include?("rating") || h.include?("score") },
          comment: header.index { |h| h.include?("comment") || h.include?("evidence") }
        }

        if index[:question_id].nil? || index[:rating].nil?
          raise Error, "The sheet needs at least a 'Question ID' and a 'Rating' column"
        end

        (2..sheet.last_row).filter_map { |number| build_answer_row(sheet.row(number), index) }
      end

      def build_answer_row(cells, index)
        raw_id = cells[index[:question_id]]
        return nil if raw_id.blank?

        question = questions[raw_id.to_i]
        rating = normalise_rating(cells[index[:rating]])
        comment = index[:comment] ? cells[index[:comment]].to_s.strip : ""

        Row.new(
          question_id: raw_id.to_i,
          prompt: question&.prompt || cells[index[:prompt].to_i].to_s,
          rating: rating,
          comment: comment,
          self_rating: rating,
          self_comment: comment,
          source: "answer_sheet",
          errors: row_errors(question, rating, comment)
        )
      end

      # === FULL FORM =========================================================

      # A filled copy of the company workbook. Parsed by the SAME reader an
      # Admin's template import uses — one parser, so a workbook that imports
      # cleanly as a template cannot fail to read as an answer sheet — and then
      # matched against this appraisal's frozen template.
      def import_full_form
        parsed = TemplateImport.call(file: @file)

        if parsed[:layout] != "sectioned"
          raise Error, "That file doesn't look like an appraisal workbook. Download this appraisal's " \
                       "workbook from the Export button and fill that in, or upload the company " \
                       "appraisal form itself."
        end

        rows, unmatched_areas = match_area_rows(parsed[:categories])
        responses, unmatched_fields, missing_fields = match_template_fields(parsed)

        summarise(
          rows,
          layout: "full_form",
          responses: responses,
          employee_fields: Array(parsed.dig(:employee_fields, :fields)).map { |field| field.slice(:key, :label, :value) },
          # Everything the workbook carried that this appraisal's template has
          # no home for. Named, never dropped: a rename or a deletion upstream
          # should cost the person a sentence of explanation, not their typing.
          unmatched: unmatched_areas + unmatched_fields,
          # And the other direction — what the form asks for that the workbook
          # didn't carry, which is what an added template field looks like.
          missing_fields: missing_fields
        )
      end

      # The workbook's performance-area rows against the template's categories,
      # matched on the normalised area name.
      def match_area_rows(categories)
        by_key = template_categories.index_by { |category| TemplateImport.field_key(category.name) }
        rows = []
        unmatched = []

        Array(categories).each do |area|
          captures = area[:captures] || {}
          self_rating = normalise_rating(captures[:self_rating])
          self_comment = captures[:self_comments].to_s.strip
          manager_rating = normalise_rating(captures[:manager_rating])
          manager_comment = captures[:manager_comments].to_s.strip

          category = by_key[TemplateImport.field_key(area[:name])]
          if category.nil?
            # Only worth reporting if the person actually wrote something in
            # it. A blank row for an area the template dropped is noise.
            if [ self_rating, self_comment.presence, manager_rating, manager_comment.presence ].any?
              unmatched << {
                label: area[:name],
                section: "Performance areas",
                reason: "This appraisal's template has no performance area called " \
                        "\"#{area[:name]}\", so what you wrote here has nowhere to go."
              }
            end
            next
          end

          # One question per area is this layout's shape, but a template
          # category carrying several still works: the area's single pair of
          # cells is offered to each of them, and the employee edits from there.
          #
          # The SELF columns are what is imported, never the manager's. This
          # endpoint is the employee's own (AppraisalPolicy#submit_self?), and
          # reading the other pair would file a manager's assessment as the
          # employee's own words. Both are carried on the row so the preview
          # can still show the whole document — read, shown, not adopted.
          category.questions.each do |question|
            rows << Row.new(
              question_id: question.id,
              prompt: question.prompt,
              rating: self_rating,
              comment: self_comment,
              self_rating: self_rating,
              self_comment: self_comment.presence,
              manager_rating: manager_rating,
              manager_comment: manager_comment.presence,
              source: "full_form",
              errors: row_errors(question, self_rating, self_comment)
            )
          end
        end

        [ rows, unmatched ]
      end

      # The template's own free-text and perspective fields, filled from the
      # workbook's development, final-review and perspective blocks.
      #
      # A LIST of {key:, value:} rather than a hash keyed by field key, and
      # that is deliberate. The controller camelises the whole preview on the
      # way out, which would rewrite "key_achievements_contributions" into
      # "keyAchievementsContributions" and quietly hand the client back keys
      # that match nothing on the form. Keeping the field key in a value
      # position puts it out of that transform's reach for good, rather than
      # relying on every future caller remembering to exempt this one hash.
      def match_template_fields(parsed)
        available = workbook_field_values(parsed)
        claimed = Set.new
        responses = []
        missing = []

        wizard_sections.each do |section|
          Array(section["fields"]).each do |field|
            key = field["key"].to_s
            next if key.blank?

            if section["kind"] == "perspectives"
              found = false
              { SubmitRevision::MANAGER_RATING_SUFFIX => :manager_rating,
                SubmitRevision::MANAGER_SUMMARY_SUFFIX => :manager_summary }.each do |suffix, attribute|
                value = available.dig(key, attribute)
                next if value.blank?

                responses << { key: "#{key}#{suffix}", value: value }
                claimed << key
                found = true
              end
              missing << { key: key, label: field["label"], section: section["title"] } unless found
              next
            end

            value = available.dig(key, :value)
            if value.blank?
              missing << { key: key, label: field["label"], section: section["title"] }
              next
            end

            responses << { key: key, value: value }
            claimed << key
          end
        end

        unmatched = available.reject { |key, entry| claimed.include?(key) || entry[:blank] }
                             .map do |key, entry|
          {
            label: entry[:label],
            section: entry[:section],
            reason: "This appraisal's template has no field called \"#{entry[:label]}\", " \
                    "so what you wrote here has nowhere to go."
          }
        end

        [ responses, unmatched, missing ]
      end

      # Everything answerable the workbook carried, keyed the same way the
      # template's own fields are. `blank:` is tracked rather than filtered so
      # an empty field is not reported as unmatched — an untouched section of a
      # blank form is not a problem to explain to anybody.
      def workbook_field_values(parsed)
        values = {}

        Array(parsed[:perspectives]).each do |perspective|
          rating = perspective[:manager_rating].to_s.strip.presence
          summary = perspective[:manager_summary].to_s.strip.presence
          values[perspective[:key].to_s] = {
            label: perspective[:name], section: "Performance perspectives",
            manager_rating: rating, manager_summary: summary,
            blank: rating.nil? && summary.nil?
          }
        end

        {
          "Development & career discussion" => parsed[:development_fields],
          "Final review" => parsed[:final_review_fields]
        }.each do |section, fields|
          Array(fields).each do |field|
            value = field[:value].to_s.strip.presence
            values[field[:key].to_s] = {
              label: field[:label], section: section, value: value, blank: value.nil?
            }
          end
        end

        values
      end

      def wizard_sections
        structure = template.structure || {}
        Array(structure["wizardSections"] || structure["wizard_sections"])
      end

      def template_categories
        @template_categories ||= template.categories.includes(:questions).to_a
      end

      # === shared ============================================================

      def summarise(rows, layout:, **extra)
        {
          layout: layout,
          rows: rows.map(&:to_h),
          valid_count: rows.count(&:valid?),
          invalid_count: rows.reject(&:valid?).size,
          # How much of the form the file actually answered — the number the
          # employee checks before trusting the import.
          answered_count: rows.count { |row| row.rating.present? || row.comment.present? },
          total_questions: questions.size,
          responses: [],
          employee_fields: [],
          unmatched: [],
          missing_fields: []
        }.merge(extra)
      end

      # Excel hands back a rating as a Float (4.0), Roo sometimes as a String.
      # Blank stays blank: an unfilled cell is "not answered", never a zero.
      def normalise_rating(raw)
        text = raw.to_s.strip
        return nil if text.blank?
        return nil unless text.match?(/\A-?\d+(\.\d+)?\z/)

        text.to_d.round.to_i
      end

      # The same rules the model enforces, applied at preview time so the
      # person sees the problems before they commit rather than after.
      #
      # A blank rating is NOT an error here. A part-filled workbook is the
      # normal way people work through one, and the missing answers are caught
      # by the form's own completeness check at submit time.
      def row_errors(question, rating, comment)
        errors = []
        errors << "That question isn't part of this appraisal's template" if question.nil?
        if rating.present? && !AppraisalAnswer::RATING_RANGE.cover?(rating)
          errors << "Rating must be between 1 and 5"
        end
        if rating.present? && AppraisalAnswer::RATINGS_REQUIRING_COMMENT.include?(rating) && comment.blank?
          errors << "A rating of #{rating} needs evidence"
        end
        errors << "This question requires a comment" if question&.requires_comment? && rating.present? && comment.blank?
        errors
      end
  end
end
