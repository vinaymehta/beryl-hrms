module Appraisals
  # Parses a spreadsheet into template categories and questions (scope §5).
  #
  # Upload → Validate → Parse → PREVIEW → Admin confirms → Save. Like
  # SelfAppraisalImport, this persists NOTHING: the parsed structure goes back to
  # the builder, the admin edits and confirms it there, and the ordinary create
  # endpoint writes it. So every template rule — the 100% weight total, required
  # prompts, the frozen-once-in-use guard — applies exactly as it does to a
  # hand-built template, because it IS one.
  #
  # Expected sheet, one row per QUESTION, grouped by category:
  #
  #   Category | Lens | Weight % | Question | Guidance |
  #   Self rating | Manager rating | Evidence required | Required
  #
  # Category, Lens and Weight repeat on every row of a category; the first row
  # wins and later disagreements are reported rather than silently applied.
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

    DEFAULT_AREA_LENSES = {
      "technical skills & code quality" => "past",
      "delivery & productivity" => "past",
      "ownership & accountability" => "past",
      "ai & modern engineering skills" => "future_readiness",
      "learning & skill growth" => "current_capability",
      "communication & teamwork" => "current_capability",
      "business & client impact" => "past"
    }.freeze

    TRUTHY = %w[y yes true 1 required].freeze

    def self.call(...) = new(...).call

    def initialize(file:)
      @file = file
    end

    def call
      validate_file!
      categories = parse

      raise Error, "No question rows were found in that file" if categories.empty?

      total = categories.sum { |category| category[:weight].to_d }
      {
        categories: categories,
        total_weight: total.to_f,
        # Mirrors AppraisalTemplate's own activation rule so the admin sees the
        # problem in the preview rather than on save.
        weights_valid: total == 100,
        question_count: categories.sum { |category| category[:questions].size },
        errors: categories.flat_map { |category| category[:errors] }
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

      def spreadsheet
        ext = File.extname(@file.original_filename.to_s).delete(".")
        ext = "xlsx" if ext.downcase == "xlsm"
        @spreadsheet ||= Roo::Spreadsheet.open(
          @file.tempfile.path, extension: ext
        )
      rescue StandardError => e
        raise Error, "That file couldn't be read as a spreadsheet (#{e.class})"
      end

      def column_index(header)
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

      def parse
        sheet = spreadsheet.sheet(0)
        header_row = 1
        index = nil

        (1..[sheet.last_row, 25].min).each do |number|
          cells = sheet.row(number)
          next if cells.blank?

          idx = column_index(cells)
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

          name = cells[index[:category]].to_s.strip
          prompt = cells[index[:prompt]].to_s.strip
          # The unit of import is a QUESTION, so a row without one carries
          # nothing — blank spacer rows and the notes line at the foot of the
          # downloaded format both land here and are skipped rather than
          # becoming a category with a sentence for a name.
          next if prompt.blank? || name.blank?

          category = (grouped[name.downcase] ||= new_category(name, cells, index, number))
          record_conflicts(category, cells, index, number)

          category[:questions] << {
            prompt: prompt,
            description: read(cells, index[:guidance]),
            self_rating: flag(cells, index[:self_rating], default: true),
            manager_rating: flag(cells, index[:manager_rating], default: true),
            requires_comment: flag(cells, index[:requires_comment], default: false),
            required: flag(cells, index[:required], default: true)
          }
        end

        grouped.values.each_with_index.map { |category, position| category.merge(position: position) }
      end

      def new_category(name, cells, index, row_number)
        errors = []
        errors << "Row #{row_number}: category name is blank" if name.blank?

        raw_lens = read(cells, index[:lens])
        lens = normalise_lens(raw_lens)
        lens ||= DEFAULT_AREA_LENSES[name.downcase]
        if raw_lens.present? && lens.nil?
          errors << "Row #{row_number}: '#{raw_lens}' is not a known lens"
        end
        lens ||= "past"

        raw_weight = read(cells, index[:weight]).to_s.delete("%").strip
        errors << "Row #{row_number}: weight is missing" if raw_weight.blank?

        weight = raw_weight.presence&.to_d&.to_f || 0.0
        weight = (weight * 100).round(2) if weight <= 1.0 && weight > 0

        {
          name: name,
          lens: lens,
          weight: weight,
          questions: [],
          errors: errors
        }
      end

      # A category's lens and weight are per-category, but live on every row. If
      # two rows disagree, say so instead of silently taking the first.
      def record_conflicts(category, cells, index, row_number)
        raw_lens = read(cells, index[:lens])
        lens = normalise_lens(raw_lens)
        if lens.present? && lens != category[:lens]
          category[:errors] << "Row #{row_number}: lens '#{lens}' disagrees with '#{category[:lens]}' set earlier for #{category[:name]}"
        end

        raw_weight = read(cells, index[:weight]).to_s.delete("%").strip
        if raw_weight.present?
          weight = raw_weight.to_d.to_f
          weight = (weight * 100).round(2) if weight <= 1.0 && weight > 0
          if weight != category[:weight]
            category[:errors] << "Row #{row_number}: weight #{raw_weight} disagrees with #{category[:weight]} set earlier for #{category[:name]}"
          end
        end
      end

      def normalise_lens(raw)
        LENS_ALIASES[raw.to_s.strip.downcase.gsub(/\s+/, " ")]
      end

      def read(cells, position)
        position.nil? ? nil : cells[position].to_s.strip.presence
      end

      # A blank cell means "use the sensible default", not "false" — an admin
      # who leaves the flag columns empty expects the ordinary behaviour.
      def flag(cells, position, default:)
        raw = read(cells, position)
        return default if raw.nil?

        TRUTHY.include?(raw.downcase)
      end
  end
end
