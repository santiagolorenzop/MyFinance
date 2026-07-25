export type CompactProgressTone =
  | 'normal'
  | 'near'
  | 'over'
  | 'healthy'
  | 'watch'
  | 'alert'

interface CompactProgressProps {
  /** Precomputed ratio from services (0–1+). Null when not applicable. */
  ratio: number | null
  label: string
  tone?: CompactProgressTone
}

/**
 * Compact progress indicator for monthly stats — presentation only.
 * Expects a ratio already computed by budget services.
 */
export function CompactProgress({
  ratio,
  label,
  tone = 'normal',
}: CompactProgressProps) {
  if (ratio == null) {
    return (
      <div className="compact-progress" aria-label={label}>
        <div className="compact-progress__track" />
      </div>
    )
  }

  const widthPct = Math.max(0, Math.min(ratio, 1)) * 100

  return (
    <div
      className={`compact-progress compact-progress--${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Math.min(ratio, 1) * 100)}
    >
      <div className="compact-progress__track">
        <div className="compact-progress__fill" style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  )
}
