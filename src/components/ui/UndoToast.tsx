import { UNDO_TIMEOUT_MS } from '@/config/app'
import { t } from '@/i18n'

interface UndoToastProps {
  visible: boolean
  onUndo: () => void
  disabled?: boolean
}

/** Compact latest-only undo affordance. Placed at the bottom so amount entry stays clear. */
export function UndoToast({ visible, onUndo, disabled = false }: UndoToastProps) {
  if (!visible) return null

  return (
    <div
      className="undo-toast"
      role="status"
      aria-live="polite"
      data-timeout-ms={UNDO_TIMEOUT_MS}
    >
      <span>{t('expense.saved')}</span>
      <button
        type="button"
        className="undo-toast__action"
        onClick={onUndo}
        disabled={disabled}
      >
        {t('expense.undo')}
      </button>
    </div>
  )
}
