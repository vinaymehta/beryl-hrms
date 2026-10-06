module Employees
  # A password the system makes up, for an administrator to see and an
  # employee to type out of an email.
  #
  # Being TYPED is what shapes the alphabet. This password arrives in a mail
  # and is copied into a login form by hand, often from a phone, so every
  # character that can be misread costs somebody a failed sign-in: 0 and O, 1
  # and l and I are all left out, and the symbols are ones every keyboard has
  # in plain sight.
  #
  # Twelve characters with at least one lowercase letter, capital, digit and
  # symbol — an ordinary-looking password rather than a dashed token — which
  # also satisfies the usual "mixed character types" rule wherever the employee
  # might reuse the habit. Mirrored by generatePassword() on the frontend.
  module GeneratedPassword
    LOWER = (("a".."z").to_a - %w[l o]).freeze
    UPPER = (("A".."Z").to_a - %w[I O]).freeze
    DIGITS = ("2".."9").to_a.freeze
    SYMBOLS = %w[@ # $ % & * ! ?].freeze
    ALL = (LOWER + UPPER + DIGITS + SYMBOLS).freeze

    LENGTH = 12

    def self.call
      required = [ LOWER, UPPER, DIGITS, SYMBOLS ].map { |set| set.sample(random: SecureRandom) }
      rest = Array.new(LENGTH - required.size) { ALL.sample(random: SecureRandom) }
      (required + rest).shuffle(random: SecureRandom).join
    end
  end
end
