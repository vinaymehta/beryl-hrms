module Employees
  # The employee code to offer for the next hire.
  #
  # A company sets one starting code in Settings — "BOO1", "ACM-001", "E100" —
  # and every code after it is that same pattern with the trailing number
  # incremented. The point is that HR types the shape once rather than a code
  # per person, and that two people adding employees on the same afternoon
  # don't both reach for the same number.
  #
  # What it deliberately does NOT do is reserve or assign anything. It returns
  # a SUGGESTION the form prefills, which the user is free to overwrite; the
  # database's own uniqueness constraint remains the thing that actually
  # decides. Reserving would mean handing out codes to forms that get
  # abandoned, leaving permanent gaps in a sequence somebody is reading as a
  # headcount.
  class NextCode
    # Splits a code into everything-before-the-final-digits and those digits:
    #   "BOO1"    -> ["BOO",    "1"]
    #   "ACM-007" -> ["ACM-00", "7"]  … see PADDING below
    #   "E100"    -> ["E",      "100"]
    TRAILING_NUMBER = /\A(.*?)(\d+)\z/

    def self.call(...) = new(...).call

    def initialize(company:)
      @company = company
      @initial = company.employee_code_initial.to_s.strip
    end

    # @return [String, nil] nil when no starting code is configured, which the
    #   form reads as "leave the field empty and let them type one".
    def call
      return nil if @initial.blank?

      match = @initial.match(TRAILING_NUMBER)
      # A starting code with no number in it can't be incremented. Offering it
      # verbatim for the second hire would collide, so it is offered once and
      # then left alone rather than guessed at.
      return taken?(@initial) ? nil : @initial if match.nil?

      prefix, digits = match.captures
      next_number = highest_used(prefix, digits.length) + 1
      format_code(prefix, next_number, digits)
    end

    private
      # Zero-padding is inferred from the starting code rather than configured:
      # somebody who wrote "ACM-001" means three digits, and somebody who wrote
      # "BOO1" does not want "BOO0002". Once the number outgrows the padding it
      # simply gets wider, which is the only sane thing to do at 999 → 1000.
      def format_code(prefix, number, original_digits)
        padded = original_digits.start_with?("0") ? number.to_s.rjust(original_digits.length, "0") : number.to_s
        "#{prefix}#{padded}"
      end

      # The highest number already used under this prefix, or the starting
      # code's own number minus one when nothing has been issued yet — so the
      # very first suggestion is the starting code itself.
      #
      # Reads what EXISTS rather than counting: employees get deleted and codes
      # get typed by hand, and a count would start handing out duplicates the
      # first time either happened.
      def highest_used(prefix, _width)
        start = @initial.match(TRAILING_NUMBER)[2].to_i

        used = @company.employees
                       .where("employee_code LIKE ?", "#{sanitize_like(prefix)}%")
                       .pluck(:employee_code)
                       .filter_map { |code| code.to_s.delete_prefix(prefix).presence }
                       .filter_map { |rest| rest.match?(/\A\d+\z/) ? rest.to_i : nil }

        [ used.max.to_i, start - 1 ].max
      end

      def taken?(code)
        @company.employees.exists?(employee_code: code)
      end

      def sanitize_like(value)
        value.gsub(/[\\%_]/) { |char| "\\#{char}" }
      end
  end
end
