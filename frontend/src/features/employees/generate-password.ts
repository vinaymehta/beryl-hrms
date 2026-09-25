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
 * Grouped into blocks of four, because a 16-character run of random letters is
 * transcribed wrongly far more often than four short ones.
 */
const UNAMBIGUOUS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
const LENGTH = 16
const GROUP = 4

export function generatePassword() {
  // crypto, not Math.random: this is a credential, and Math.random is not
  // required to be unpredictable by anything.
  const bytes = new Uint32Array(LENGTH)
  crypto.getRandomValues(bytes)

  const characters = Array.from(bytes, (byte) => UNAMBIGUOUS[byte % UNAMBIGUOUS.length])
  return characters
    .reduce<string[]>((groups, character, index) => {
      if (index % GROUP === 0) groups.push("")
      groups[groups.length - 1] += character
      return groups
    }, [])
    .join("-")
}
