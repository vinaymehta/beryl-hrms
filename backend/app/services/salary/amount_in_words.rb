module Salary
  # An amount of rupees in words, in Indian numbering — lakh and crore, not
  # million — as the salary slip's "Net Amount Pay" row spells it out:
  #
  #   AmountInWords.call(61_500)   → "Sixty One Thousand Five Hundred"
  #   AmountInWords.call(123_456)  → "One Lakh Twenty Three Thousand Four Hundred Fifty Six"
  #   AmountInWords.call(2550.5)   → "Two Thousand Five Hundred Fifty and Fifty Paise"
  #   AmountInWords.call(0)        → "Zero"
  #
  # No "and" inside the rupees and no "Rs"/"Only" around them: the slip adds
  # those, so the wording of the row stays in one place. Paise are rounded to
  # whole paise and named only when there are any.
  module AmountInWords
    ONES = %w[Zero One Two Three Four Five Six Seven Eight Nine Ten Eleven Twelve Thirteen Fourteen
              Fifteen Sixteen Seventeen Eighteen Nineteen].freeze
    TENS = %w[_ _ Twenty Thirty Forty Fifty Sixty Seventy Eighty Ninety].freeze
    CRORE = 10_000_000
    LAKH = 100_000

    def self.call(amount)
      amount = Appraisals::SalaryStructure.decimal(amount).round(2)
      rupees = amount.abs.truncate.to_i
      paise = ((amount.abs - amount.abs.truncate) * 100).round.to_i

      words = rupees.zero? ? ONES[0] : whole(rupees)
      words = "#{words} and #{below_hundred(paise)} Paise" if paise.positive?
      amount.negative? ? "Minus #{words}" : words
    end

    # A positive whole number. Above 99 crore the crores are themselves
    # counted in words ("One Hundred Crore"), as Indian usage has it.
    def self.whole(number)
      parts = []
      parts << "#{whole(number / CRORE)} Crore" if number >= CRORE
      number %= CRORE
      parts << "#{below_hundred(number / LAKH)} Lakh" if number >= LAKH
      number %= LAKH
      parts << "#{below_hundred(number / 1000)} Thousand" if number >= 1000
      number %= 1000
      parts << "#{ONES[number / 100]} Hundred" if number >= 100
      number %= 100
      parts << below_hundred(number) if number.positive?
      parts.join(" ")
    end

    def self.below_hundred(number)
      return ONES[number] if number < 20

      [ TENS[number / 10], (ONES[number % 10] unless (number % 10).zero?) ].compact.join(" ")
    end

    private_class_method :whole, :below_hundred
  end
end
