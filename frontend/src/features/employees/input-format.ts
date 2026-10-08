/**
 * Keystroke filters for the employee form's phone and postal-code inputs.
 */

/** Phone and postal code are digits only — anything else is dropped as it is typed or pasted. */
export const digitsOnly = (value: string) => value.replace(/\D/g, "")

/**
 * A mobile number as its ten digits. No maxLength on the input: the browser
 * would cut a pasted "+91 98765 43210" at ten characters, before the
 * punctuation is gone. The +91 / 91 country code is dropped instead.
 */
export const mobileDigits = (value: string) => {
  const digits = digitsOnly(value)
  return (digits.length > 10 && digits.startsWith("91") ? digits.slice(2) : digits).slice(0, 10)
}
