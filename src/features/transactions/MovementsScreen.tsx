import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { t } from '@/i18n'
import { fromMinorUnits } from '@/services/money'
import {
  EMPTY_MOVEMENT_FILTERS,
  hasActiveFilters,
  queryMovements,
  type MovementFilters,
} from '@/services/movement'
import { listAccounts } from '@/repositories/accountsRepository'
import { listCategories } from '@/repositories/categoriesRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { listFunds } from '@/repositories/fundsRepository'
import { listAllTransactions } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import type { Account, Category, Currency, Fund, Transaction, Treatment } from '@/domain/types'
import type { TransactionType } from '@/domain/enums'
import { TRANSACTION_TYPES } from '@/domain/enums'

const FILTERABLE_TYPES = TRANSACTION_TYPES.filter((type) => type !== 'adjustment')

function typeLabel(type: TransactionType): string {
  if (type === 'expense') return t('movements.types.expense')
  if (type === 'income') return t('movements.types.income')
  if (type === 'transfer') return t('movements.types.transfer')
  return t('movements.types.adjustment')
}

function matchLabel(field: string): string {
  return field
}

/**
 * Movements list — search/filter via pure movement + search services.
 * Tap-first actions only (gestures deferred).
 */
export function MovementsScreen() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filters, setFilters] = useState<MovementFilters>(EMPTY_MOVEMENT_FILTERS)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [
          nextTx,
          nextAccounts,
          nextCategories,
          nextFunds,
          nextTreatments,
          nextCurrencies,
        ] = await Promise.all([
          listAllTransactions(),
          listAccounts(true),
          listCategories(true),
          listFunds(true),
          listTreatments(),
          listCurrencies(),
        ])
        if (cancelled) return
        setTransactions(nextTx)
        setAccounts(nextAccounts)
        setCategories(nextCategories)
        setFunds(nextFunds)
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

  const accountById = useMemo(() => {
    const map = new Map<string, Account>()
    for (const account of accounts) map.set(account.id, account)
    return map
  }, [accounts])

  const items = useMemo(
    () =>
      queryMovements({
        transactions,
        filters,
        searchQuery,
        searchContext: { categories, accounts, funds, treatments },
      }),
    [transactions, filters, searchQuery, categories, accounts, funds, treatments],
  )

  function toggleType(type: TransactionType) {
    setFilters((current) => {
      const exists = current.types.includes(type)
      return {
        ...current,
        types: exists
          ? current.types.filter((row) => row !== type)
          : [...current.types, type],
      }
    })
  }

  if (loading) {
    return (
      <AppShell title={t('movements.heading')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell title={t('movements.heading')}>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{t('movements.heading')}</h2>
          <div className="inline-actions">
            <Link className="secondary-button" to="/add-income">
              {t('movements.addIncome')}
            </Link>
            <Link className="secondary-button" to="/add-transfer">
              {t('movements.addTransfer')}
            </Link>
          </div>
        </div>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        <label className="field">
          <span className="sr-only">{t('movements.searchPlaceholder')}</span>
          <input
            className="field__control"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('movements.searchPlaceholder')}
          />
        </label>

        <div className="inline-actions">
          <button
            type="button"
            className="secondary-button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((value) => !value)}
          >
            {filtersOpen ? t('movements.hideFilters') : t('movements.filters')}
            {hasActiveFilters(filters) ? ' ·' : ''}
          </button>
          {hasActiveFilters(filters) ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setFilters(EMPTY_MOVEMENT_FILTERS)}
            >
              {t('movements.clearFilters')}
            </button>
          ) : null}
        </div>

        {filtersOpen ? (
          <div className="stack skeleton-block">
            <p className="field__label">{t('movements.type')}</p>
            <div className="chip-row">
              {FILTERABLE_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  className="chip"
                  aria-pressed={filters.types.includes(type)}
                  onClick={() => toggleType(type)}
                >
                  {typeLabel(type)}
                </button>
              ))}
            </div>

            <label className="field">
              <span className="field__label">{t('movements.account')}</span>
              <select
                className="field__control"
                value={filters.accountIds[0] ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    accountIds: event.target.value ? [event.target.value] : [],
                  }))
                }
              >
                <option value="">{t('app.clear')}</option>
                {accounts
                  .filter((row) => row.archivedAt == null)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">{t('movements.category')}</span>
              <select
                className="field__control"
                value={filters.categoryIds[0] ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    categoryIds: event.target.value ? [event.target.value] : [],
                  }))
                }
              >
                <option value="">{t('app.clear')}</option>
                {categories
                  .filter((row) => row.archivedAt == null)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="field">
              <span className="field__label">{t('movements.dateFrom')}</span>
              <input
                className="field__control"
                type="date"
                value={filters.dateFrom ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    dateFrom: event.target.value || null,
                  }))
                }
              />
            </label>

            <label className="field">
              <span className="field__label">{t('movements.dateTo')}</span>
              <input
                className="field__control"
                type="date"
                value={filters.dateTo ?? ''}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    dateTo: event.target.value || null,
                  }))
                }
              />
            </label>
          </div>
        ) : null}

        {items.length === 0 ? (
          <p className="screen__note">{t('movements.empty')}</p>
        ) : (
          <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {items.map(({ transaction, matchedFields }) => {
              const account = accountById.get(transaction.accountId)
              const currency = currencyByCode[transaction.originalCurrencyCode]
              const amountLabel = fromMinorUnits(
                transaction.originalAmountMinor,
                currency?.decimalPlaces ?? 2,
              )
              const nonTitleMatches = matchedFields.filter(
                (field) => field !== 'title' && field !== 'normalizedTitle',
              )
              return (
                <li key={transaction.id}>
                  <Link
                    className="list-row"
                    to={`/transactions/${transaction.id}`}
                    style={{ width: '100%', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{transaction.title}</span>
                      <span className="screen__note">
                        {transaction.date} · {typeLabel(transaction.transactionType)}
                        {account ? ` · ${account.name}` : ''}
                      </span>
                      {nonTitleMatches.length > 0 ? (
                        <span className="screen__note">
                          {t('movements.matchedVia')}:{' '}
                          {nonTitleMatches.map(matchLabel).join(', ')}
                        </span>
                      ) : null}
                    </span>
                    <span>
                      {amountLabel} {transaction.originalCurrencyCode}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </AppShell>
  )
}
