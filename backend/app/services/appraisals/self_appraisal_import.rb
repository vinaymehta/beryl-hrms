module Appraisals
  # The scope's Excel workflow:
  #
  #   Upload → Validate → Parse → Preview → Employee Confirms → Save/Submit
  #
  # This class covers Upload/Validate/Parse/Preview ONLY, and deliberately
  # persists nothing. The employee reviews the parsed rows in the form and then
  # submits through the ordinary #submit_self path, so:
  #
  #   • the database stays the system of record — a spreadsheet is an input
  #     convenience, never a source of truth;
  #   • every validation, permission check and immutable-revision rule applies
  #     exactly as it does to a typed submission, because it IS one.
  #
  # Expected sheet: a header row, then one row per question with the columns
  # Question ID | Question | Rating | Comments. Question ID is what binds a row
  # to a question; the prompt is carried for the preview only, so a reworded
  # column can't silently attach an answer to the wrong question.
  class SelfAppraisalImport
    class Error < StandardError; end

    MAX_BYTES = 2.megabytes
    PERMITTED_EXTENSIONS = %w[.xlsx .xlsm .csv].freeze

    Row = Struct.new(:question_id, :prompt, :rating, :comment, :errors, keyword_init: true) do
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

      rows = parse_rows
      raise Error, "No question rows were found in that file" if rows.empty?

      {
        rows: rows.map { |row| row.to_h },
        valid_count: rows.count(&:valid?),
        invalid_count: rows.reject(&:valid?).size,
        total_questions: questions.size
      }
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
      # A workbook without the sheet (hand-built, or a CSV) is allowed through —
      # the endpoint is already scoped to one appraisal and gated on
      # AppraisalPolicy#submit_self?, so the metadata is a mis-file guard, not
      # the access control.
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

      # Questions of the CYCLE's frozen template — a row pointing at a question
      # from some newer template version is rejected, not quietly accepted.
      def questions
        @questions ||= AppraisalTemplateQuestion
          .joins(:appraisal_template_category)
          .where(appraisal_template_categories: { appraisal_template_id: @appraisal.appraisal_cycle.appraisal_template_id })
          .index_by(&:id)
      end

      def parse_rows
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

        (2..sheet.last_row).filter_map { |number| build_row(sheet.row(number), index) }
      end

      def build_row(cells, index)
        raw_id = cells[index[:question_id]]
        return nil if raw_id.blank?

        question = questions[raw_id.to_i]
        rating = cells[index[:rating]]
        rating = rating.to_i if rating.present?
        comment = index[:comment] ? cells[index[:comment]].to_s.strip : ""

        Row.new(
          question_id: raw_id.to_i,
          prompt: question&.prompt || cells[index[:prompt].to_i].to_s,
          rating: rating,
          comment: comment,
          errors: row_errors(question, rating, comment)
        )
      end

      # The same rules the model enforces, applied at preview time so the
      # employee sees the problems before they commit rather than after.
      def row_errors(question, rating, comment)
        errors = []
        errors << "That question isn't part of this appraisal's template" if question.nil?
        if rating.present? && !AppraisalAnswer::RATING_RANGE.cover?(rating)
          errors << "Rating must be between 1 and 5"
        end
        if rating.present? && AppraisalAnswer::RATINGS_REQUIRING_COMMENT.include?(rating) && comment.blank?
          errors << "A rating of #{rating} needs evidence"
        end
        errors << "This question requires a comment" if question&.requires_comment? && comment.blank?
        errors
      end
  end
end
