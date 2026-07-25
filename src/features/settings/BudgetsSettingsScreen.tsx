import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppState } from '@/app/appState'
import type { BudgetAllocation, BudgetPlan, Category, Currency } from '@/domain/types'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import { fromMinorUnits, parseUserAmountInput } from '@/services/money'
import { sumAllocations } from '@/services/budget'
import {
  createBudgetPlan,
  listAllocations,
  listBudgetPlans,
  listCategories,
  listCurrencies,
} from '@/repositories'
import { todayFinancialDate } from '@/utils/dates'

export function BudgetsSettingsScreen() {
  const { settings } = useAppState()
  const [plans, setPlans] = useState<BudgetPlan[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const baseCurrency = settings?.baseCurrency ?? 'USD'
  const currency = currencies.find((c) => c.code === baseCurrency)

  const reload = useCallback(async () => {
    const [nextPlans, nextCategories, nextCurrencies] = await Promise.all([
      listBudgetPlans(),
      listCategories(),
      listCurrencies(true),
    ])
    setPlans(nextPlans)
    setCategories(nextCategories)
    setCurrencies(nextCurrencies)
    const current = nextPlans[0]?.id ?? null
    setSelectedId(current)
    if (current) {
      setAllocations(await listAllocations(current))
    } else {
      setAllocations([])
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    if (!selectedId) return
    void listAllocations(selectedId).then(setAllocations)
  }, [selectedId])

  const totalPreview = useMemo(() => {
    try {
      const rows = categories.map((category) => ({
        allocatedAmountMinor: parseUserAmountInput(
          amounts[category.id] || '0',
          currency?.decimalPlaces ?? 2,
        ),
      }))
      return sumAllocations(
        rows.map((row, index) => ({
          id: String(index),
          budgetPlanId: 'preview',
          categoryId: categories[index]?.id ?? '',
          allocatedAmountMinor: row.allocatedAmountMinor,
          sortOrder: index,
          createdAt: '',
          updatedAt: '',
        })),
      )
    } catch {
      return null
    }
  }, [amounts, categories, currency?.decimalPlaces])

  async function onCreateVersion() {
    setError(null)
    if (categories.length === 0) {
      setError(t('settings.noCategoriesForBudget'))
      return
    }
    try {
      const nextAllocations = categories
        .map((category) => ({
          categoryId: category.id,
          allocatedAmountMinor: parseUserAmountInput(
            amounts[category.id] || '0',
            currency?.decimalPlaces ?? 2,
          ),
        }))
        .filter((row) => row.allocatedAmountMinor > 0)

      await createBudgetPlan({
        name: 'Monthly budget',
        baseCurrencyCode: baseCurrency,
        effectiveFrom: todayFinancialDate(),
        allocations: nextAllocations,
      })
      setAmounts({})
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.generic'))
    }
  }

  return (
    <SettingsLayout
      title={t('settings.budgets')}
      heading={t('settings.budgets')}
      error={error}
    >
      <div className="stack">
        {plans.length === 0 ? (
          <p className="screen__note">{t('settings.emptyList')}</p>
        ) : (
          plans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              className="list-row"
              style={{ width: '100%', textAlign: 'left' }}
              onClick={() => setSelectedId(plan.id)}
            >
              <span>
                <strong>{plan.name}</strong>
                <div className="screen__note">
                  {plan.effectiveFrom}
                  {plan.effectiveTo ? ` → ${plan.effectiveTo}` : ' → open'}
                </div>
              </span>
              {selectedId === plan.id ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))
        )}
      </div>

      {selectedId ? (
        <div className="stack skeleton-block">
          <p className="screen__subheading">{t('settings.allocations')}</p>
          {allocations.length === 0 ? (
            <p className="screen__note">{t('settings.emptyList')}</p>
          ) : (
            allocations.map((row) => {
              const category = categories.find((c) => c.id === row.categoryId)
              return (
                <div key={row.id} className="list-row">
                  <span>{category?.name ?? row.categoryId}</span>
                  <span>
                    {fromMinorUnits(row.allocatedAmountMinor, currency?.decimalPlaces ?? 2)}{' '}
                    {baseCurrency}
                  </span>
                </div>
              )
            })
          )}
          <p className="screen__note">
            {t('app.total')}:{' '}
            {fromMinorUnits(sumAllocations(allocations), currency?.decimalPlaces ?? 2)}{' '}
            {baseCurrency}
          </p>
        </div>
      ) : null}

      <div className="stack skeleton-block">
        <p className="screen__subheading">{t('settings.newBudgetVersion')}</p>
        {categories.length === 0 ? (
          <p className="screen__note">{t('settings.noCategoriesForBudget')}</p>
        ) : (
          categories.map((category) => (
            <label key={category.id} className="field">
              <span className="field__label">{category.name}</span>
              <input
                className="field__control"
                inputMode="decimal"
                value={amounts[category.id] ?? ''}
                onChange={(e) =>
                  setAmounts((prev) => ({ ...prev, [category.id]: e.target.value }))
                }
              />
            </label>
          ))
        )}
        {totalPreview != null ? (
          <p className="screen__note">
            {t('app.total')}: {fromMinorUnits(totalPreview, currency?.decimalPlaces ?? 2)}{' '}
            {baseCurrency}
          </p>
        ) : null}
        <button type="button" className="primary-button" onClick={() => void onCreateVersion()}>
          {t('settings.createBudget')}
        </button>
      </div>
    </SettingsLayout>
  )
}
