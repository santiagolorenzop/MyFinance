import { t } from '@/i18n'

interface DebtAmountFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** When true, show debt checkbox and store negative on save via parent helpers. */
  enableDebtMode: boolean
  isDebt: boolean
  onDebtChange: (isDebt: boolean) => void
  hint?: string
}

/**
 * Amount field with optional “this amount is debt” toggle for credit cards / loans.
 * Desktop users may still type a leading minus directly.
 */
export function DebtAmountField({
  label,
  value,
  onChange,
  enableDebtMode,
  isDebt,
  onDebtChange,
  hint,
}: DebtAmountFieldProps) {
  return (
    <div className="stack" style={{ gap: 'var(--space-2)' }}>
      <label className="field">
        <span className="field__label">{label}</span>
        <input
          className="field__control"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {enableDebtMode ? (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={isDebt}
            onChange={(e) => onDebtChange(e.target.checked)}
          />
          <span>{t('settings.amountIsDebt')}</span>
        </label>
      ) : null}
      {hint ? <p className="screen__note">{hint}</p> : null}
    </div>
  )
}
