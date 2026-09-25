"use client"

import { useEffect, useState } from "react"

/**
 * The value, but only once it has stopped changing.
 *
 * For anything that turns a keystroke into a request: without it, typing
 * "Priya" is five searches, four of which are already stale before they
 * return, and the last one can arrive first.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs)
    return () => clearTimeout(timer)
  }, [value, delayMs])

  return settled
}
