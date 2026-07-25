import { useCallback, useEffect, useState } from 'react'
import type { Treatment } from '@/domain/types'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import { listTreatments, renameTreatment, setTreatmentActive } from '@/repositories'

export function TreatmentsSettingsScreen() {
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    const rows = await listTreatments()
    setTreatments(rows)
    setDrafts(Object.fromEntries(rows.map((row) => [row.id, row.displayName])))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  return (
    <SettingsLayout
      title={t('settings.treatments')}
      heading={t('settings.treatments')}
      description={t('settings.behavior')}
      error={error}
    >
      <div className="stack">
        {treatments.map((treatment) => (
          <div key={treatment.id} className="stack skeleton-block">
            <span className="screen__note">
              {treatment.behaviorKey}
              {treatment.isSystem ? ` · ${t('settings.system')}` : ''}
            </span>
            <label className="field">
              <span className="field__label">{t('settings.displayName')}</span>
              <input
                className="field__control"
                value={drafts[treatment.id] ?? ''}
                onChange={(e) =>
                  setDrafts((prev) => ({ ...prev, [treatment.id]: e.target.value }))
                }
              />
            </label>
            <div className="inline-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  void renameTreatment(treatment.id, drafts[treatment.id] ?? treatment.displayName)
                    .then(reload)
                    .catch(() => setError(t('errors.generic')))
                }}
              >
                {t('app.save')}
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void setTreatmentActive(treatment.id, !treatment.isActive)
                    .then(reload)
                    .catch(() => setError(t('errors.generic')))
                }}
              >
                {treatment.isActive ? t('app.archive') : t('settings.active')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </SettingsLayout>
  )
}
