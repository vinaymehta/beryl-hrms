/** Reads a single non-HttpOnly cookie by name from document.cookie. Client-side only. */
export function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`))

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined
}
