import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { t } from '@/i18n'
import { fromMinorUnits } from '@/services/money'
import {
  buildBalancesView,
  buildReportingNetWorth,
} from '@/services/accountBalance'
import { formatExchangeRateAsOf } from '@/services/exchangeRate'
import { listAccounts } from '@/repositories/accountsRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { listExchangeRates } from '@/repositories/exchangeRatesRepository'
import { getSettings } from '@/repositories/settingsRepository'
import { listAllTransactions } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import type {
  Account,
  Currency,
  ExchangeRate,
  Transaction,
  Treatment,
  UserSettings,
} from '@/domain/types'

/**
 * Balances list — native per-account amounts, plus approximate USD net worth
 * from the current cached exchange rate (display only).
 */
export function BalancesScreen() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [rates, setRates] = useState<ExchangeRate[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [
          nextAccounts,
          nextTx,
          nextTreatments,
          nextCurrencies,
          nextRates,
          nextSettings,
        ] = await Promise.all([
          listAccounts(true),
          listAllTransactions(),
          listTreatments(),
          listCurrencies(),
          listExchangeRates(),
          getSettings(),
        ])
        if (cancelled) return
        setAccounts(nextAccounts)
        setTransactions(nextTx)
        setTreatments(nextTreatments)
        setCurrencies(nextCurrencies)
        setRates(nextRates)
        setSettings(nextSettings ?? null)
      } catch {
        if (!cancelled) setError(t('errors.generic'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const currencyByCode = useMemo(() => {
    const map: Record<string, Currency> = {}
    for (const currency of currencies) map[currency.code] = currency
    return map
  }, [currencies])

  const view = useMemo(
    () => buildBalancesView(accounts, transactions, treatments),
    [accounts, transactions, treatments],
  )

  const baseCurrency =
    settings?.reportingCurrency ?? settings?.baseCurrency ?? 'USD'
  const baseDp = currencyByCode[baseCurrency]?.decimalPlaces ?? 2

  const netWorth = useMemo(
    () =>
      buildReportingNetWorth({
        totalsByCurrency: view.totalsByCurrency,
        baseCurrencyCode: baseCurrency,
        rates,
        currencies: currencyByCode,
      }),
    [view.totalsByCurrency, baseCurrency, rates, currencyByCode],
  )

  const rateAsOf =
    netWorth.parts.find((part) => part.rateAsOf != null)?.rateAsOf ?? null

  if (loading) {
    return (
      <AppShell title={t('balances.heading')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell title={t('balances.heading')}>
      <section className="screen">
        <h2 className="screen__heading">{t('balances.heading')}</h2>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        {view.accountBalances.length === 0 ? (
          <p className="screen__note">{t('balances.empty')}</p>
        ) : (
          <>
            <div className="stack">
              <p className="field__label">{t('balances.netWorth')}</p>
              {netWorth.totalBaseMinor != null ? (
                <p className="stat-cell__value">
                  {fromMinorUnits(netWorth.totalBaseMinor, baseDp)} {baseCurrency}
                </p>
              ) : (
                <p className="screen__note">{t('balances.netWorthUnavailable')}</p>
              )}
              <p className="screen__note">{t('balances.netWorthHint')}</p>

              {netWorth.parts.map((part) => {
                const dp = currencyByCode[part.currencyCode]?.decimalPlaces ?? 2
                const native = `${fromMinorUnits(part.nativeMinor, dp)} ${part.currencyCode}`
                if (part.currencyCode === baseCurrency) {
                  return (
                    <p key={part.currencyCode} className="screen__note">
                      {native}
                    </p>
                  )
                }
                const approx =
                  part.baseMinor != null
                    ? `≈ ${fromMinorUnits(part.baseMinor, baseDp)} ${baseCurrency}`
                    : '≈ —'
                return (
                  <p key={part.currencyCode} className="screen__note">
                    {native} ({approx})
                  </p>
                )
              })}

              {rateAsOf ? (
                <p className="screen__note">
                  {t('balances.rateAsOf')} {formatExchangeRateAsOf(rateAsOf)}.
                </p>
              ) : null}

              <Link className="secondary-button" to="/settings/currencies">
                {t('balances.manageRates')}
              </Link>
            </div>

            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {view.accountBalances.map(({ account, balanceMinor, currencyCode }) => (
                <li key={account.id}>
                  <Link
                    className="list-row"
                    to={`/balances/${account.id}`}
                    style={{ width: '100%', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{account.name}</span>
                      <span className="screen__note">
                        {account.includeInTotalNetBalance
                          ? t('balances.includedInTotal')
                          : t('balances.excludedFromTotal')}
                      </span>
                    </span>
                    <span>
                      {fromMinorUnits(
                        balanceMinor,
                        currencyByCode[currencyCode]?.decimalPlaces ?? 2,
                      )}{' '}
                      {currencyCode}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </AppShell>
  )
}
