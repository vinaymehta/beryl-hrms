module JobOpenings
  # The code and slug a job opening is suggested, and given when saved without
  # one. Both are unique: a clash gets -2, -3… appended.
  #
  #   code  BS-<first 3 letters of the category>-<initials of the title>
  #         Engineering + "Graduate Engineer Trainee" → BS-ENG-GET
  #   slug  the title, parameterized → graduate-engineer-trainee
  #
  # A suggestion, not a reservation: two admins could be offered the same one,
  # and the uniqueness validation (and index) settles it at save.
  module Identifiers
    PREFIX = "BS".freeze
    # Left out of the initials, so "Head of Sales" is HS rather than HOS.
    SMALL_WORDS = %w[a an and at for in of on or the to with].freeze
    MAX_INITIALS = 6

    module_function

    def code_for(title, category, except_id: nil)
      category_part = category.to_s.gsub(/[^A-Za-z0-9]/, "").first(3).upcase
      words = title.to_s.scan(/[A-Za-z0-9]+/)
      significant = words.reject { |word| SMALL_WORDS.include?(word.downcase) }
      initials = (significant.presence || words).map { |word| word[0] }.join.first(MAX_INITIALS).upcase

      base = [ PREFIX, category_part.presence, initials.presence ].compact.join("-")
      unique_variant(:code, base, except_id: except_id)
    end

    def slug_for(title, except_id: nil)
      base = title.to_s.parameterize.presence || "job-opening"
      unique_variant(:slug, base, except_id: except_id)
    end

    # The first of base, base-2, base-3… no other opening holds. Codes are
    # stored upper case and slugs lower case, so the comparison is too. Cut
    # short first so a suffix never takes it past the column's length limit.
    def unique_variant(column, base, except_id: nil)
      base = base.first(JobOpening::LIMITS.fetch(column) - 4).delete_suffix("-")
      base = column == :code ? base.upcase : base.downcase
      taken = JobOpening.where.not(id: except_id)
                        .where("#{column} = :base OR #{column} LIKE :pattern",
                               base: base, pattern: "#{JobOpening.sanitize_sql_like(base)}-%")
                        .pluck(column).to_set
      return base unless taken.include?(base)

      suffix = 2
      suffix += 1 while taken.include?("#{base}-#{suffix}")
      "#{base}-#{suffix}"
    end

    # Whether `value` is free for the opening `except_id` (nil when new).
    def available?(column, value, except_id: nil)
      value = column == :code ? value.to_s.strip.upcase : value.to_s.strip.downcase
      value.present? && !JobOpening.where.not(id: except_id).exists?(column => value)
    end
  end
end
