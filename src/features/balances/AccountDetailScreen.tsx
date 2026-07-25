import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { t } from '@/i18n'
import { fromMinorUnits } from '@/services/money'
import {
  calculateAccountBalance,
  recentTransactionsForAccount,
} from '@/services/accountBalance'
import { listAccounts } from '@/repositories/accountsRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { listAllTransactions } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import type { Account, Currency, Transaction, Treatment } from '@/domain/types'

function typeLabel(type: Transaction['transactionType']): string {
  if (type === 'expense') return t('movements.types.expense')
  if (type === 'income') return t('movements.types.income')
  if (type === 'transfer') return t('movements.types.transfer')
  return t('movements.types.adjustment')
}

/**
 * Account detail — balance from accountBalanceService; movements from ledger filter helper.
 */
export function AccountDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [account, setAccount] = useState<Account | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!id) return
      try {
        const [accounts, nextTx, nextTreatments, nextCurrencies] = await Promise.all([
          listAccounts(true),
          listAllTransactions(),
          listTreatments(),
          listCurrencies(),
        ])
        if (cancelled) return
        setAccount(accounts.find((row) => row.id === id) ?? null)
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
  }, [id])

  const currencyByCode = useMemo(() => {
    const map: Record<string, Currency> = {}
    for (const currency of currencies) map[currency.code] = currency
    return map
  }, [currencies])

  const balance = useMemo(() => {
    if (!account) return null
    return calculateAccountBalance(account, transactions, treatments)
  }, [account, transactions, treatments])

  const recent = useMemo(() => {
    if (!account) return []
    return recentTransactionsForAccount(transactions, account.id)
  }, [account, transactions])

  if (loading) {
    return (
      <AppShell title={t('balances.accountDetail')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (!account || !balance) {
    return (
      <AppShell title={t('balances.accountDetail')}>
        <section className="screen">
          <p className="screen__note">{t('movements.notFound')}</p>
          <Link className="primary-button" to="/balances">
            {t('app.back')}
          </Link>
        </section>
      </AppShell>
    )
  }

  const dp = currencyByCode[balance.currencyCode]?.decimalPlaces ?? 2

  return (
    <AppShell title={account.name}>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{account.name}</h2>
          <p className="stat-cell__value">
            {fromMinorUnits(balance.balanceMinor, dp)} {balance.currencyCode}
          </p>
          <p className="screen__note">
            {account.includeInTotalNetBalance
              ? t('balances.includedInTotal')
              : t('balances.excludedFromTotal')}
          </p>
        </div>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="stack">
          <p className="field__label">{t('balances.recentMovements')}</p>
          {recent.length === 0 ? (
            <p className="screen__note">{t('balances.noMovements')}</p>
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {recent.map((tx) => (
                <li key={tx.id}>
                  <Link
                    className="list-row"
                    to={`/transactions/${tx.id}`}
                    style={{ width: '100%', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{tx.title}</span>
                      <span className="screen__note">
                        {tx.date} · {typeLabel(tx.transactionType)}
                      </span>
                    </span>
                    <span>
                      {fromMinorUnits(
                        tx.accountAmountMinor,
                        currencyByCode[tx.accountCurrencyCode]?.decimalPlaces ?? 2,
                      )}{' '}
                      {tx.accountCurrencyCode}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link className="secondary-button" to="/balances">
          {t('app.back')}
        </Link>
      </section>
    </AppShell>
  )
}
