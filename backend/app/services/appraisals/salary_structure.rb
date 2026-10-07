module Appraisals
  # The appraisal letter's COMPENSATION AND BENEFITS STRUCTURE, as arithmetic.
  #
  # Every amount is MONTHLY INR; the letter's annual column is simply × 12.
  # The monthly gross is the sum of the EARNINGS rows only — the two EPF rows
  # sit in the table but are not part of gross — and the annual CTC adds the
  # employer's EPF on top, because that is money the company spends on the
  # employee without it ever appearing in their gross.
  #
  # The split itself comes from company rules (Company#salary_rules), set once
  # in Settings. They only PRE-FILL the Discussion form: Admin/HR may change any
  # row, and what they save is what the letter prints. The frontend runs the
  # same formula live, so the two must agree — the reference check is a gross
  # of 80,000 giving Basic 40,000, HRA 20,000, Conveyance 1,600 and Special
  # Allowance 18,400.
  class SalaryStructure
    # Table order, as the letter prints it.
    KEYS = %w[basic hra epf_employee conveyance special_allowance incentive others epf_employer].freeze
    EARNINGS = %w[basic hra conveyance special_allowance incentive others].freeze
    # The row names exactly as the reference letter prints them.
    LABELS = {
      "basic" => "Basic",
      "hra" => "House Rent Allowance",
      "epf_employee" => "E.P.F.EMPLOYEE",
      "conveyance" => "Conveyance",
      "special_allowance" => "Special Allowance",
      "incentive" => "Incentive",
      "others" => "Others",
      "epf_employer" => "E.P.F.EMPLOYER"
    }.freeze

    # Derived from the reference letter's own numbers. EPF is off by default:
    # the reference shows it as "-".
    DEFAULT_RULES = {
      "basic_percent_of_gross" => 50,
      "hra_percent_of_basic" => 50,
      "conveyance_amount" => 1600,
      "epf_employee_percent_of_basic" => 0,
      "epf_employer_percent_of_basic" => 0,
      "incentive_amount" => 0,
      "others_amount" => 0
    }.freeze
    PERCENT_RULES = %w[basic_percent_of_gross hra_percent_of_basic
                       epf_employee_percent_of_basic epf_employer_percent_of_basic].freeze
    # For error messages, worded as the Settings form labels them.
    RULE_LABELS = {
      "basic_percent_of_gross" => "Basic (% of gross)",
      "hra_percent_of_basic" => "HRA (% of basic)",
      "conveyance_amount" => "Conveyance",
      "epf_employee_percent_of_basic" => "Employee EPF (% of basic)",
      "epf_employer_percent_of_basic" => "Employer EPF (% of basic)",
      "incentive_amount" => "Incentive",
      "others_amount" => "Others"
    }.freeze

    class InvalidRules < StandardError; end

    # The breakdown for a new monthly gross, whole rupees.
    #
    # Special allowance is the balancing row — whatever is left once the fixed
    # rows are taken — and is never negative. When the fixed rows already
    # exceed the gross (a small salary under a large conveyance, say), it is 0
    # and the earnings then add up to MORE than the gross; that shortfall is
    # not hidden here but caught by AppraisalCompensationDecision's sum check,
    # so HR sees it and adjusts a row rather than a letter going out wrong.
    def self.from_rules(gross_monthly, rules)
      gross = decimal(gross_monthly)
      rules = normalize_rules(rules)

      basic = (gross * rules["basic_percent_of_gross"] / 100).round
      hra = (basic * rules["hra_percent_of_basic"] / 100).round
      conveyance = rules["conveyance_amount"].round
      incentive = rules["incentive_amount"].round
      others = rules["others_amount"].round
      special = [ gross - (basic + hra + conveyance + incentive + others), 0 ].max.round

      {
        "basic" => basic,
        "hra" => hra,
        "epf_employee" => (basic * rules["epf_employee_percent_of_basic"] / 100).round,
        "conveyance" => conveyance,
        "special_allowance" => special,
        "incentive" => incentive,
        "others" => others,
        "epf_employer" => (basic * rules["epf_employer_percent_of_basic"] / 100).round
      }.transform_values { |value| storable(value) }
    end

    def self.monthly_gross(breakdown)
      breakdown = breakdown.to_h.stringify_keys
      EARNINGS.sum { |key| decimal(breakdown[key]) }
    end

    def self.annual_ctc(breakdown)
      (monthly_gross(breakdown) + decimal(breakdown.to_h.stringify_keys["epf_employer"])) * 12
    end

    # The rules with every gap filled from DEFAULT_RULES, as numbers. Raises
    # InvalidRules for a value that isn't a non-negative number (or a
    # percentage over 100), which the Settings endpoint reports as a 422.
    def self.normalize_rules(rules)
      given = (rules || {}).to_h.stringify_keys.slice(*DEFAULT_RULES.keys).reject { |_, value| value.to_s.strip.empty? }

      DEFAULT_RULES.merge(given).to_h do |key, value|
        label = RULE_LABELS.fetch(key)
        number = numeric(value) or raise InvalidRules, "#{label} must be a number"
        raise InvalidRules, "#{label} can't be negative" if number.negative?
        raise InvalidRules, "#{label} can't be more than 100" if PERCENT_RULES.include?(key) && number > 100

        [ key, number ]
      end
    end

    # A breakdown as submitted by the Discussion form: only the known rows,
    # each rounded to two decimals. Missing rows are 0 rather than an error —
    # an untouched "Others" row is not a mistake. Something that isn't a
    # number is passed through untouched, for AppraisalCompensationDecision's
    # validation to name, rather than silently read as 0 here.
    # Returns nil when nothing was submitted at all.
    def self.normalize_breakdown(breakdown)
      return nil if breakdown.blank?

      given = breakdown.to_h.stringify_keys
      KEYS.to_h do |key|
        raw = given[key]
        next [ key, 0 ] if raw.to_s.strip.empty?

        number = numeric(raw)
        [ key, number ? storable(number.round(2)) : raw.to_s ]
      end
    end

    # Indian digit grouping, as the letter prints amounts: 480000 → "4,80,000".
    # Paise only when there are any.
    def self.format_amount(amount)
      number = decimal(amount).round(2)
      whole, fraction = number.abs.to_s("F").split(".")
      grouped = whole.length > 3 ? "#{whole[0...-3].reverse.scan(/\d{1,2}/).join(',').reverse},#{whole[-3..]}" : whole
      grouped = "#{grouped}.#{fraction.ljust(2, '0')}" unless fraction.to_i.zero?
      number.negative? ? "-#{grouped}" : grouped
    end

    # The number in a value, or nil when there isn't one.
    def self.numeric(value)
      BigDecimal(value.to_s.strip)
    rescue ArgumentError, TypeError
      nil
    end

    # jsonb stores numbers, not BigDecimals (which would serialise as
    # strings). Whole rupees stay integers so the stored row reads cleanly.
    def self.storable(number)
      number = decimal(number)
      number.frac.zero? ? number.to_i : number.to_f
    end

    # Lenient: blank or unreadable counts as 0. For arithmetic on values that
    # have already been through normalize_breakdown and validation.
    def self.decimal(value)
      numeric(value) || BigDecimal("0")
    end
  end
end
