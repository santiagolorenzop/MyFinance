import { useEffect, useState } from 'react'
import { useAppState } from '@/app/appState'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import { getPeriodForDate } from '@/services/period'
import { updateSettings } from '@/repositories'
import { todayFinancialDate } from '@/utils/dates'

export function PeriodSettingsScreen() {
  const { settings, refreshSettings } = useAppState()
  const [day, setDay] = useState(settings?.financialPeriodStartDay ?? 1)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings) setDay(settings.financialPeriodStartDay)
  }, [settings])

  const preview =
    day >= 1 && day <= 31 ? getPeriodForDate(day, todayFinancialDate()) : null

  async function onSave() {
    setError(null)
    setSaved(false)
    if (day < 1 || day > 31) {
      setError(t('errors.generic'))
      return
    }
    try {
      await updateSettings({ financialPeriodStartDay: day })
      await refreshSettings()
      setSaved(true)
    } catch {
      setError(t('errors.generic'))
    }
  }

  return (
    <SettingsLayout
      title={t('settings.period')}
      heading={t('settings.period')}
      description={t('onboarding.periodBody')}
      error={error}
    >
      <label className="field">
        <span className="field__label">{t('settings.periodStartDay')}</span>
        <input
          className="field__control"
          type="number"
          min={1}
          max={31}
          value={day}
          onChange={(e) => setDay(Number(e.target.value))}
        />
      </label>
      {preview ? (
        <p className="screen__note">
          {preview.start} – {preview.end}
        </p>
      ) : null}
      <button type="button" className="primary-button" onClick={() => void onSave()}>
        {t('app.save')}
      </button>
      {saved ? <p className="screen__note">{t('app.done')}</p> : null}
    </SettingsLayout>
  )
}
