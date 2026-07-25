import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppState } from '@/app/appState'
import type { Currency, ExchangeRate } from '@/domain/types'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import {
  formatExchangeRateAsOf,
  refreshExchangeRates,
  saveManualExchangeRate,
} from '@/services/exchangeRate'
import {
  listCurrencies,
  listExchangeRates,
  setCurrencyActive,
  updateSettings,
  upsertCurrency,
} from '@/repositories'

export function CurrenciesSettingsScreen() {
  const { settings, refreshSettings } = useAppState()
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [decimalPlaces, setDecimalPlaces] = useState(2)
  const [baseCurrency, setBaseCurrency] = useState(settings?.baseCurrency ?? 'USD')
  const [manualRate, setManualRate] = useState('')

  const reload = useCallback(async () => {
    const [nextCurrencies, nextRates] = await Promise.all([
      listCurrencies(),
      listExchangeRates(),
    ])
    setCurrencies(nextCurrencies)
    setRates(nextRates)
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (settings) setBaseCurrency(settings.baseCurrency)
  }, [settings])

  const usdCop = useMemo(
    () => rates.find((row) => row.baseCurrencyCode === 'USD' && row.quoteCurrencyCode === 'COP'),
    [rates],
  )

  async function onSaveBase() {
    setError(null)
    setMessage(null)
    try {
      await updateSettings({
        baseCurrency,
        reportingCurrency: baseCurrency,
      })
      await refreshSettings()
      setMessage(t('app.done'))
    } catch {
      setError(t('errors.generic'))
    }
  }

  async function onRefreshRates() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const base = settings?.baseCurrency ?? baseCurrency
      const quotes = currencies
        .filter((row) => row.active && row.code !== base)
        .map((row) => row.code)
      const result = await refreshExchangeRates({
        baseCurrencyCode: base,
        quoteCurrencyCodes: quotes.length > 0 ? quotes : ['COP'],
      })
      await reload()
      if (!result.ok) {
        setError(result.error)
      } else {
        setMessage(t('app.done'))
      }
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function onSaveManual() {
    setError(null)
    setMessage(null)
    if (!manualRate.trim()) {
      setError(t('errors.generic'))
      return
    }
    try {
      await saveManualExchangeRate({
        baseCurrencyCode: 'USD',
        quoteCurrencyCode: 'COP',
        rate: manualRate,
      })
      setManualRate('')
      await reload()
      setMessage(t('app.done'))
    } catch {
      setError(t('errors.generic'))
    }
  }

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
      {message ? (
        <p className="screen__note" role="status">
          {message}
        </p>
      ) : null}

      <div className="stack skeleton-block">
        <label className="field">
          <span className="field__label">{t('settings.baseReportingCurrency')}</span>
          <select
            className="field__control"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value)}
          >
            {currencies
              .filter((row) => row.active)
              .map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code}
                </option>
              ))}
          </select>
        </label>
        <button type="button" className="secondary-button" onClick={() => void onSaveBase()}>
          {t('app.save')}
        </button>
      </div>

      <div className="stack skeleton-block">
        <p className="field__label">{t('settings.exchangeRate')}</p>
        <p className="screen__note">
          {t('settings.exchangeRatePair')}: {usdCop?.rate ?? '—'}
        </p>
        <p className="screen__note">
          {t('settings.exchangeRateUpdated')}:{' '}
          {usdCop ? formatExchangeRateAsOf(usdCop.asOf) : '—'}
        </p>
        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => void onRefreshRates()}
        >
          {t('settings.exchangeRateRefresh')}
        </button>
        <label className="field">
          <span className="field__label">{t('settings.exchangeRateManual')}</span>
          <input
            className="field__control"
            inputMode="decimal"
            value={manualRate}
            onChange={(e) => setManualRate(e.target.value)}
            placeholder={usdCop?.rate ?? '4050'}
          />
        </label>
        <button type="button" className="secondary-button" onClick={() => void onSaveManual()}>
          {t('settings.exchangeRateSaveManual')}
        </button>
      </div>

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
