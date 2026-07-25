import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppState } from '@/app/appState'
import type { BudgetAllocation, BudgetPlan, Category, Currency } from '@/domain/types'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import { filterCategoriesByKind } from '@/services/category'
import { fromMinorUnits, parseUserAmountInput } from '@/services/money'
import { sumAllocations } from '@/services/budget'
import {
  createBudgetPlan,
  listAllocations,
  listBudgetPlans,
  listCategories,
  listCurrencies,
  replaceAllocations,
} from '@/repositories'
import { addCalendarDays, todayFinancialDate } from '@/utils/dates'

function buildAmountDraft(
  expenseCategories: Category[],
  allocations: BudgetAllocation[],
  decimalPlaces: number,
): Record<string, string> {
  const next: Record<string, string> = {}
  for (const category of expenseCategories) {
    const row = allocations.find((item) => item.categoryId === category.id)
    next[category.id] =
      row != null ? fromMinorUnits(row.allocatedAmountMinor, decimalPlaces) : ''
  }
  return next
}

export function BudgetsSettingsScreen() {
  const { settings } = useAppState()
  const [plans, setPlans] = useState<BudgetPlan[]>([])
  const [openPlan, setOpenPlan] = useState<BudgetPlan | null>(null)
  const [allocations, setAllocations] = useState<BudgetAllocation[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [savedNote, setSavedNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const baseCurrency = settings?.baseCurrency ?? 'USD'
  const currency = currencies.find((c) => c.code === baseCurrency)
  const decimalPlaces = currency?.decimalPlaces ?? 2

  const expenseCategories = useMemo(
    () => filterCategoriesByKind(categories, 'expense'),
    [categories],
  )

  const reload = useCallback(async () => {
    const [nextPlans, nextCategories, nextCurrencies] = await Promise.all([
      listBudgetPlans(),
      listCategories(),
      listCurrencies(true),
    ])
    setPlans(nextPlans)
    setCategories(nextCategories)
    setCurrencies(nextCurrencies)

    const currentOpen = nextPlans.find((plan) => plan.effectiveTo == null) ?? null
    setOpenPlan(currentOpen)

    if (currentOpen) {
      const nextAllocations = await listAllocations(currentOpen.id)
      setAllocations(nextAllocations)
      setAmounts(
        buildAmountDraft(
          filterCategoriesByKind(nextCategories, 'expense'),
          nextAllocations,
          nextCurrencies.find((c) => c.code === (settings?.baseCurrency ?? 'USD'))
            ?.decimalPlaces ?? 2,
        ),
      )
    } else {
      setAllocations([])
      setAmounts({})
    }
  }, [settings?.baseCurrency])

  useEffect(() => {
    void reload()
  }, [reload])

  const totalPreview = useMemo(() => {
    try {
      const rows = expenseCategories.map((category) => ({
        allocatedAmountMinor: parseUserAmountInput(
          amounts[category.id] || '0',
          decimalPlaces,
        ),
      }))
      return sumAllocations(
        rows.map((row, index) => ({
          id: String(index),
          budgetPlanId: 'preview',
          categoryId: expenseCategories[index]?.id ?? '',
          allocatedAmountMinor: row.allocatedAmountMinor,
          sortOrder: index,
          createdAt: '',
          updatedAt: '',
        })),
      )
    } catch {
      return null
    }
  }, [amounts, expenseCategories, decimalPlaces])

  function parseDraftAllocations() {
    return expenseCategories
      .map((category) => ({
        categoryId: category.id,
        allocatedAmountMinor: parseUserAmountInput(
          amounts[category.id] || '0',
          decimalPlaces,
        ),
      }))
      .filter((row) => row.allocatedAmountMinor > 0)
  }

  async function onSaveCurrent() {
    setError(null)
    setSavedNote(null)
    if (expenseCategories.length === 0) {
      setError(t('settings.noCategoriesForBudget'))
      return
    }
    setSaving(true)
    try {
      const nextAllocations = parseDraftAllocations()
      if (openPlan) {
        await replaceAllocations(openPlan.id, nextAllocations)
        setSavedNote(t('settings.budgetSaved'))
      } else {
        await createBudgetPlan({
          name: 'Monthly budget',
          baseCurrencyCode: baseCurrency,
          effectiveFrom: todayFinancialDate(),
          allocations: nextAllocations,
        })
        setSavedNote(t('settings.budgetCreated'))
      }
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  /**
   * Optional cutover: close today's open plan and start a new version tomorrow.
   * Mid-period amount tweaks should use Save current budget instead.
   */
  async function onCreateVersionFromTomorrow() {
    setError(null)
    setSavedNote(null)
    if (expenseCategories.length === 0) {
      setError(t('settings.noCategoriesForBudget'))
      return
    }
    if (!openPlan) {
      setError(t('settings.budgetVersionNeedsCurrent'))
      return
    }
    setSaving(true)
    try {
      const nextAllocations = parseDraftAllocations()
      await createBudgetPlan({
        name: 'Monthly budget',
        baseCurrencyCode: baseCurrency,
        effectiveFrom: addCalendarDays(todayFinancialDate(), 1),
        allocations: nextAllocations,
      })
      setSavedNote(t('settings.budgetVersionCreated'))
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  const closedPlans = plans.filter((plan) => plan.effectiveTo != null)

  return (
    <SettingsLayout
      title={t('settings.budgets')}
      heading={t('settings.budgets')}
      error={error}
    >
      {openPlan ? (
        <p className="screen__note">
          {t('settings.currentBudget')}: {openPlan.effectiveFrom} → {t('settings.budgetOpen')}
        </p>
      ) : (
        <p className="screen__note">{t('settings.noCurrentBudget')}</p>
      )}

      <div className="stack skeleton-block">
        <p className="screen__subheading">
          {openPlan ? t('settings.editCurrentBudget') : t('settings.createBudget')}
        </p>
        {expenseCategories.length === 0 ? (
          <p className="screen__note">{t('settings.noCategoriesForBudget')}</p>
        ) : (
          expenseCategories.map((category) => (
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
            {t('app.total')}: {fromMinorUnits(totalPreview, decimalPlaces)} {baseCurrency}
          </p>
        ) : null}
        <button
          type="button"
          className="primary-button"
          disabled={saving}
          onClick={() => void onSaveCurrent()}
        >
          {openPlan ? t('settings.saveCurrentBudget') : t('settings.createBudget')}
        </button>
        {openPlan ? (
          <button
            type="button"
            className="secondary-button"
            disabled={saving}
            onClick={() => void onCreateVersionFromTomorrow()}
          >
            {t('settings.newBudgetVersionTomorrow')}
          </button>
        ) : null}
        {savedNote ? (
          <p className="screen__note" role="status">
            {savedNote}
          </p>
        ) : null}
        {openPlan ? (
          <p className="screen__note">{t('settings.budgetEditHint')}</p>
        ) : null}
      </div>

      {closedPlans.length > 0 ? (
        <div className="stack">
          <p className="field__label">{t('settings.previousBudgetVersions')}</p>
          {closedPlans.map((plan) => (
            <div key={plan.id} className="list-row">
              <span>
                <strong>{plan.name}</strong>
                <div className="screen__note">
                  {plan.effectiveFrom} → {plan.effectiveTo}
                </div>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {openPlan && allocations.length > 0 ? (
        <div className="stack">
          <p className="screen__note">
            {t('app.total')}: {fromMinorUnits(sumAllocations(allocations), decimalPlaces)}{' '}
            {baseCurrency}
          </p>
        </div>
      ) : null}
    </SettingsLayout>
  )
}
