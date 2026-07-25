/**
 * Centralized motion durations (ms).
 * Typical UI transitions: 150–250 ms per plan.
 */
export const MOTION = {
  fast: 150,
  normal: 200,
  slow: 250,
} as const

export type MotionDuration = (typeof MOTION)[keyof typeof MOTION]

/** CSS custom-property values (with unit). */
export const MOTION_CSS = {
  fast: `${MOTION.fast}ms`,
  normal: `${MOTION.normal}ms`,
  slow: `${MOTION.slow}ms`,
} as const
