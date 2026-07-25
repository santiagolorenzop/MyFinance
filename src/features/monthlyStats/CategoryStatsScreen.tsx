import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { CompactProgress } from '@/components/ui/CompactProgress'
import { t } from '@/i18n'
import { fromMinorUnits } from '@/services/money'
import {
  buildMonthlyStatsView,
  categoryPeriodTransactions,
  findCategoryPresentation,
} from '@/services/budget'
import { listAllocations, listBudgetPlans } from '@/repositories/budgetsRepository'
import { listCategories } from '@/repositories/categoriesRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { getSettings } from '@/repositories/settingsRepository'
import { listAllTransactions } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import type {
  BudgetAllocation,
  BudgetPlan,
  Category,
  Currency,
  Transaction,
  Treatment,
  UserSettings,
} from '@/domain/types'
import type { CategoryBudgetStatus } from '@/services/budget'

function statusLabel(status: CategoryBudgetStatus): string {
  return t(`monthlyStats.status.${status}`)
}

function progressTone(status: CategoryBudgetStatus): 'normal' | 'near' | 'over' {
  if (status === 'over_budget') return 'over'
  if (status === 'near_limit') return 'near'
  return 'normal'
}

/**
 * Category drill-down for the active financial period.
 */
export function CategoryStatsScreen() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [plans, setPlans] = useState<BudgetPlan[]>([])
  const [allocationsByPlanId, setAllocationsByPlanId] = useState<
    Record<string, BudgetAllocation[]>
  >({})
  const [categories, setCategories] = useState<Category[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [nextSettings, nextPlans, nextCategories, nextTx, nextTreatments, nextCurrencies] =
          await Promise.all([
            getSettings(),
            listBudgetPlans(),
            listCategories(true),
            listAllTransactions(),
            listTreatments(),
            listCurrencies(),
          ])
        if (cancelled) return
        const allocMap: Record<string, BudgetAllocation[]> = {}
        await Promise.all(
          nextPlans.map(async (plan) => {
            allocMap[plan.id] = await listAllocations(plan.id)
          }),
        )
        if (cancelled) return
        setSettings(nextSettings ?? null)
        setPlans(nextPlans)
        setAllocationsByPlanId(allocMap)
        setCategories(nextCategories)
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

  const view = useMemo(() => {
    if (!settings) return null
    return buildMonthlyStatsView({
      financialPeriodStartDay: settings.financialPeriodStartDay,
      plans,
      allocationsByPlanId,
      categories,
      transactions,
      treatments,
    })
  }, [settings, plans, allocationsByPlanId, categories, transactions, treatments])

  const categoryStat = useMemo(() => {
    if (!view || !id) return null
    return findCategoryPresentation(view, id)
  }, [view, id])

  const rows = useMemo(() => {
    if (!view || !id) return []
    return categoryPeriodTransactions({
      transactions,
      treatments,
      period: view.period,
      today: view.today,
      categoryId: id,
    })
  }, [view, id, transactions, treatments])

  const baseDp = useMemo(() => {
    const code = settings?.baseCurrency ?? 'USD'
    return currencies.find((row) => row.code === code)?.decimalPlaces ?? 2
  }, [currencies, settings?.baseCurrency])

  if (loading || !settings || !view) {
    return (
      <AppShell title={t('monthlyStats.categoryDetail')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (!categoryStat) {
    return (
      <AppShell title={t('monthlyStats.categoryDetail')}>
        <section className="screen">
          <p className="screen__note">{t('monthlyStats.noCategoryActivity')}</p>
          <Link className="primary-button" to="/monthly-stats">
            {t('app.back')}
          </Link>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell title={categoryStat.categoryName}>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{categoryStat.categoryName}</h2>
          <p className="screen__note">{statusLabel(categoryStat.status)}</p>
          <p>
            {fromMinorUnits(categoryStat.spentMinor, baseDp)} {t('monthlyStats.spentOf')}{' '}
            {fromMinorUnits(categoryStat.allocatedMinor, baseDp)} {settings.baseCurrency}
          </p>
          <p>
            {categoryStat.isOverBudget
              ? `${fromMinorUnits(categoryStat.overBudgetMinor, baseDp)} ${t('monthlyStats.overBudgetAmount')}`
              : `${fromMinorUnits(categoryStat.remainingDisplayMinor, baseDp)} ${t('monthlyStats.remaining')}`}
          </p>
          {categoryStat.percentageSpent != null ? (
            <p>
              {categoryStat.percentageSpent}
              {t('monthlyStats.percentSpent')}
            </p>
          ) : null}
          <CompactProgress
            ratio={categoryStat.progressRatio}
            label={categoryStat.categoryName}
            tone={progressTone(categoryStat.status)}
          />
        </div>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="stack">
          <p className="field__label">{t('balances.recentMovements')}</p>
          {rows.length === 0 ? (
            <p className="screen__note">{t('monthlyStats.noCategoryActivity')}</p>
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {rows.map((tx) => (
                <li key={tx.id}>
                  <Link
                    className="list-row"
                    to={`/transactions/${tx.id}`}
                    style={{ width: '100%', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>{tx.title}</span>
                      <span className="screen__note">{tx.date}</span>
                    </span>
                    <span>
                      {fromMinorUnits(tx.baseCurrencyAmountMinor ?? 0, baseDp)}{' '}
                      {settings.baseCurrency}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Link className="secondary-button" to="/monthly-stats">
          {t('app.back')}
        </Link>
      </section>
    </AppShell>
  )
}
