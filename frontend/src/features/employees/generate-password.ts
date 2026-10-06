/**
 * A password the system makes up, for an administrator to see and an employee
 * to type out of an email.
 *
 * Mirrors Employees::GeneratedPassword on the server, which is what generates
 * one when the client doesn't send any. Being TYPED is what shapes the
 * alphabet: this arrives in a mail and is copied into a login form by hand,
 * often from a phone, so every character that can be misread costs somebody a
 * failed sign-in. 0 and O, 1 and l and I are all left out.
 *
 * Twelve characters with at least one lowercase letter, capital, digit and
 * symbol — an ordinary-looking password, not a dashed token.
 */
const LOWER = "abcdefghijkmnpqrstuvwxyz"
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"
const DIGITS = "23456789"
const SYMBOLS = "@#$%&*!?"
const ALL = LOWER + UPPER + DIGITS + SYMBOLS
const LENGTH = 12

// crypto, not Math.random: this is a credential, and Math.random is not
// required to be unpredictable by anything. The modulo bias over a 32-bit
// value and an alphabet this small is negligible.
function randomIndex(max: number) {
  const value = new Uint32Array(1)
  crypto.getRandomValues(value)
  return value[0] % max
}

const pick = (set: string) => set[randomIndex(set.length)]

export function generatePassword() {
  const characters = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)]
  while (characters.length < LENGTH) characters.push(pick(ALL))
  // Fisher–Yates, so the guaranteed classes aren't always in the first four slots.
  for (let i = characters.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1)
    ;[characters[i], characters[j]] = [characters[j], characters[i]]
  }
  return characters.join("")
}
