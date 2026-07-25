import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import {
  CompactProgress,
  type CompactProgressTone,
} from '@/components/ui/CompactProgress'
import { t } from '@/i18n'
import { fromMinorUnits } from '@/services/money'
import {
  buildMonthlyStatsView,
  categoryStatus,
  percentageUsed,
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

function progressTone(status: CategoryBudgetStatus): CompactProgressTone {
  if (status === 'over_budget') return 'over'
  if (status === 'near_limit') return 'near'
  return 'normal'
}

/**
 * Map a precomputed display percent to progress colors (presentation only).
 * Thresholds: under 70 healthy, under 90 watch, up to 100 alert, over 100 over.
 */
function utilizationTone(percentageSpent: number | null): CompactProgressTone {
  if (percentageSpent == null) return 'normal'
  if (percentageSpent < 70) return 'healthy'
  if (percentageSpent < 90) return 'watch'
  if (percentageSpent <= 100) return 'alert'
  return 'over'
}

/**
 * Monthly statistics — composed via buildMonthlyStatsView (budget/period services).
 */
export function MonthlyStatsScreen() {
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

  const baseDp = useMemo(() => {
    const code = settings?.baseCurrency ?? 'USD'
    return currencies.find((row) => row.code === code)?.decimalPlaces ?? 2
  }, [currencies, settings?.baseCurrency])

  if (loading || !view || !settings) {
    return (
      <AppShell title={t('monthlyStats.heading')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  const { stats } = view
  const overallRatio = percentageUsed(stats.totalSpentMinor, stats.totalBudgetMinor)
  const overallStatus = categoryStatus(stats.totalBudgetMinor, stats.totalSpentMinor)

  return (
    <AppShell title={t('monthlyStats.heading')}>
      <section className="screen">
        <h2 className="screen__heading">{t('monthlyStats.heading')}</h2>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="stack">
          <p className="field__label">{t('monthlyStats.currentPeriod')}</p>
          <p>
            {view.period.start} → {view.period.end}
          </p>
        </div>

        {!view.hasBudgetPlan ? (
          <div className="stack">
            <p className="screen__note">{t('monthlyStats.emptyBudget')}</p>
            <Link className="secondary-button" to="/settings/budgets">
              {t('monthlyStats.addBudget')}
            </Link>
          </div>
        ) : null}

        <div className="stat-grid">
          <div className="stat-cell">
            <span className="field__label">{t('monthlyStats.totalBudget')}</span>
            <span className="stat-cell__value">
              {fromMinorUnits(stats.totalBudgetMinor, baseDp)} {settings.baseCurrency}
            </span>
          </div>
          <div className="stat-cell">
            <span className="field__label">{t('monthlyStats.spent')}</span>
            <span className="stat-cell__value">
              {fromMinorUnits(stats.totalSpentMinor, baseDp)} {settings.baseCurrency}
            </span>
          </div>
          <div className="stat-cell">
            <span className="field__label">{t('monthlyStats.remaining')}</span>
            <span className="stat-cell__value">
              {fromMinorUnits(stats.remainingMinor, baseDp)} {settings.baseCurrency}
            </span>
          </div>
          <div className="stat-cell">
            <span className="field__label">{t('monthlyStats.daysLeft')}</span>
            <span className="stat-cell__value">{stats.daysLeft}</span>
          </div>
        </div>

        {view.hasBudgetPlan ? (
          <CompactProgress
            ratio={overallRatio}
            label={t('monthlyStats.spent')}
            tone={progressTone(overallStatus)}
          />
        ) : null}

        {stats.unbudgetedSpentMinor > 0 ? (
          <p className="screen__note">
            {t('monthlyStats.unbudgeted')}:{' '}
            {fromMinorUnits(stats.unbudgetedSpentMinor, baseDp)} {settings.baseCurrency}
          </p>
        ) : null}

        <div className="stack">
          <p className="field__label">{t('monthlyStats.categories')}</p>
          {view.categories.length === 0 ? (
            <p className="screen__note">{t('monthlyStats.noCategoryActivity')}</p>
          ) : (
            <ul className="budget-category-list">
              {view.categories.map((row) => {
                const tone = utilizationTone(row.percentageSpent)
                return (
                  <li key={row.categoryId}>
                    <Link
                      className="budget-category-row"
                      to={`/monthly-stats/category/${row.categoryId}`}
                    >
                      <span className="budget-category-row__name">{row.categoryName}</span>
                      <span className="budget-category-row__meter">
                        <CompactProgress
                          ratio={row.progressRatio}
                          label={row.categoryName}
                          tone={tone}
                        />
                        <span
                          className={`budget-category-row__pct budget-category-row__pct--${tone}`}
                        >
                          {row.percentageSpent != null ? `${row.percentageSpent}%` : '—'}
                        </span>
                      </span>
                      <span className="budget-category-row__amounts">
                        <span className="budget-category-row__spent">
                          {fromMinorUnits(row.spentMinor, baseDp)} /{' '}
                          {fromMinorUnits(row.allocatedMinor, baseDp)}
                        </span>
                        <span
                          className={
                            row.isOverBudget
                              ? 'budget-category-row__remaining budget-category-row__remaining--over'
                              : 'budget-category-row__remaining'
                          }
                        >
                          {row.isOverBudget
                            ? fromMinorUnits(row.remainingMinor, baseDp)
                            : `${fromMinorUnits(row.remainingDisplayMinor, baseDp)} ${t('monthlyStats.left')}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  )
}
