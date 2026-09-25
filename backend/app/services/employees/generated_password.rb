module Employees
  # A password the system makes up, for an administrator to see and an
  # employee to type out of an email.
  #
  # Being TYPED is what shapes the alphabet. This password arrives in a mail
  # and is copied into a login form by hand, often from a phone, so every
  # character that can be misread costs somebody a failed sign-in: 0 and O, 1
  # and l and I are all left out. What remains is 56 unambiguous characters,
  # and at 16 of them that is ~93 bits — far beyond anything a person would
  # have chosen, which is the reason the system generates it rather than the
  # administrator.
  #
  # Grouped into blocks of four with dashes, because a 16-character run of
  # random letters is transcribed wrongly far more often than four short ones.
  module GeneratedPassword
    # Everything a person can read back without hesitating: no 0/O, no 1/l/I.
    UNAMBIGUOUS = (("a".."z").to_a + ("A".."Z").to_a + ("2".."9").to_a - %w[l I O o]).freeze

    LENGTH = 16
    GROUP = 4

    def self.call
      characters = Array.new(LENGTH) { UNAMBIGUOUS.sample(random: SecureRandom) }
      characters.each_slice(GROUP).map(&:join).join("-")
    end
  end
end
