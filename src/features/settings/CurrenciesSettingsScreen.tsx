import { useCallback, useEffect, useState } from 'react'
import type { Currency } from '@/domain/types'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import { listCurrencies, setCurrencyActive, upsertCurrency } from '@/repositories'

export function CurrenciesSettingsScreen() {
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimalPlaces, setDecimalPlaces] = useState(2)

  const reload = useCallback(async () => {
    setCurrencies(await listCurrencies())
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  async function onAdd() {
    setError(null)
    if (!code.trim() || !displayName.trim()) {
      setError(t('errors.requiredName'))
      return
    }
    try {
      await upsertCurrency({
        code,
        displayName,
        symbol: symbol || code,
        decimalPlaces,
        active: true,
      })
      setCode('')
      setDisplayName('')
      setSymbol('')
      setDecimalPlaces(2)
      await reload()
    } catch {
      setError(t('errors.generic'))
    }
  }

  return (
    <SettingsLayout
      title={t('settings.currencies')}
      heading={t('settings.currencies')}
      error={error}
    >
      <div className="stack">
        {currencies.map((currency) => (
          <div key={currency.code} className="list-row">
            <div>
              <strong>
                {currency.code} ({currency.symbol})
              </strong>
              <div className="screen__note">
                {currency.displayName} · {currency.decimalPlaces} dp
                {!currency.active ? ` · inactive` : ''}
              </div>
            </div>
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                void setCurrencyActive(currency.code, !currency.active).then(reload)
              }}
            >
              {currency.active ? t('app.archive') : t('settings.active')}
            </button>
          </div>
        ))}
      </div>
      <div className="stack skeleton-block">
        <label className="field">
          <span className="field__label">{t('settings.code')}</span>
          <input className="field__control" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('settings.name')}</span>
          <input
            className="field__control"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">{t('settings.symbol')}</span>
          <input
            className="field__control"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">{t('settings.decimalPlaces')}</span>
          <input
            className="field__control"
            type="number"
            min={0}
            max={6}
            value={decimalPlaces}
            onChange={(e) => setDecimalPlaces(Number(e.target.value))}
          />
        </label>
        <button type="button" className="primary-button" onClick={() => void onAdd()}>
          {t('app.add')}
        </button>
      </div>
    </SettingsLayout>
  )
}
