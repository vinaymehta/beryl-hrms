/**
 * Single flip point for sections that exist in the codebase (routes, APIs,
 * DB tables all intact) but aren't part of the current UI rollout. Setting
 * one of these to `false` re-enables its nav entry and page immediately —
 * nothing else needs to change.
 */
export const HIDDEN_FEATURES = {
  attendance: true,
  leave: true,
  documents: true,
} as const

export type HiddenFeatureKey = keyof typeof HIDDEN_FEATURES
