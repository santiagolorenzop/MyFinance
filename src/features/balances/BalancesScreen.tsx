import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { t } from '@/i18n'
import { fromMinorUnits } from '@/services/money'
import { buildBalancesView } from '@/services/accountBalance'
import { listAccounts } from '@/repositories/accountsRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { listAllTransactions } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import type { Account, Currency, Transaction, Treatment } from '@/domain/types'

/**
 * Balances list — amounts derived via accountBalanceService from the ledger.
 */
export function BalancesScreen() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [nextAccounts, nextTx, nextTreatments, nextCurrencies] = await Promise.all([
          listAccounts(true),
          listAllTransactions(),
          listTreatments(),
          listCurrencies(),
        ])
        if (cancelled) return
        setAccounts(nextAccounts)
        setTransactions(nextTx)
        setTreatments(nextTreatments)
        setCurrencies(nextCurrencies)
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
              <p className="field__label">{t('balances.totalsByCurrency')}</p>
              {Object.keys(view.totalsByCurrency).length === 0 ? (
                <p className="screen__note">{t('balances.empty')}</p>
              ) : (
                Object.entries(view.totalsByCurrency).map(([code, minor]) => (
                  <p key={code} className="stat-cell__value">
                    {fromMinorUnits(minor, currencyByCode[code]?.decimalPlaces ?? 2)} {code}
                  </p>
                ))
              )}
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
