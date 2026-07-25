import { useCallback, useEffect, useState } from 'react'
import type { Fund } from '@/domain/types'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import {
  IntegrityError,
  archiveFund,
  createFund,
  deleteFund,
  listFunds,
} from '@/repositories'

export function FundsSettingsScreen() {
  const [funds, setFunds] = useState<Fund[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')

  const reload = useCallback(async () => {
    setFunds(await listFunds())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function onAdd() {
    setError(null)
    if (!name.trim()) {
      setError(t('errors.requiredName'))
      return
    }
    try {
      await createFund({ name })
      setName('')
      await reload()
    } catch {
      setError(t('errors.generic'))
    }
  }

  return (
    <SettingsLayout title={t('settings.funds')} heading={t('settings.funds')} error={error}>
      <div className="stack">
        {funds.length === 0 ? (
          <p className="screen__note">{t('settings.emptyList')}</p>
        ) : (
          funds.map((fund) => (
            <div key={fund.id} className="list-row" style={{ alignItems: 'flex-start' }}>
              <div className="stack" style={{ gap: '4px', width: '100%' }}>
                <strong>
                  {fund.name}
                  {fund.isDefault ? ` (${t('settings.default')})` : ''}
                </strong>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void archiveFund(fund.id).then(reload)}
                  >
                    {t('app.archive')}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => {
                      void deleteFund(fund.id)
                        .then(reload)
                        .catch((cause: unknown) => {
                          setError(
                            cause instanceof IntegrityError
                              ? cause.message
                              : t('settings.cannotDeleteHasHistory'),
                          )
                        })
                    }}
                  >
                    {t('app.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <div className="stack skeleton-block">
        <label className="field">
          <span className="field__label">{t('settings.name')}</span>
          <input className="field__control" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <button type="button" className="primary-button" onClick={() => void onAdd()}>
          {t('app.add')}
        </button>
      </div>
    </SettingsLayout>
  )
}
