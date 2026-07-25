import { describe, expect, it } from 'vitest'
import {
  buildMonthlyStatsView,
  categoryPeriodTransactions,
  presentCategoryBudgetStat,
} from '@/services/budget'
import {
  makeAllocation,
  makeCategory,
  makeExpense,
  makePlan,
  treatments,
} from '@/test/fixtures/engineFixtures'

describe('monthlyStatsView', () => {
  it('builds period stats using budget/period services', () => {
    const plan = makePlan({
      id: 'plan-1',
      name: 'July',
      effectiveFrom: '2026-07-01',
    })
    const categories = [makeCategory({ id: 'cat-food', name: 'Food' })]
    const allocations = [
      makeAllocation({
        id: 'alloc-1',
        budgetPlanId: 'plan-1',
        categoryId: 'cat-food',
        allocatedAmountMinor: 10_000,
      }),
    ]
    const transactions = [
      makeExpense({
        id: 'tx-1',
        title: 'Lunch',
        accountId: 'acc-1',
        categoryId: 'cat-food',
        originalAmountMinor: 2500,
        baseCurrencyAmountMinor: 2500,
        date: '2026-07-18',
        treatmentId: 'treat-monthly',
      }),
    ]

    const view = buildMonthlyStatsView({
      financialPeriodStartDay: 1,
      plans: [plan],
      allocationsByPlanId: { 'plan-1': allocations },
      categories,
      transactions,
      treatments,
      today: '2026-07-20',
    })

    expect(view.hasBudgetPlan).toBe(true)
    expect(view.period.start).toBe('2026-07-01')
    expect(view.stats.totalSpentMinor).toBe(2500)
    expect(view.stats.totalBudgetMinor).toBe(10_000)
    expect(view.stats.daysLeft).toBeGreaterThan(0)

    const presentation = view.categories[0]
    expect(presentation?.spentMinor).toBe(2500)
    expect(presentation?.allocatedMinor).toBe(10_000)
    expect(presentation?.remainingDisplayMinor).toBe(7500)
    expect(presentation?.overBudgetMinor).toBe(0)
    expect(presentation?.percentageSpent).toBe(25)
    expect(presentation?.isOverBudget).toBe(false)

    const rows = categoryPeriodTransactions({
      transactions,
      treatments,
      period: view.period,
      today: view.today,
      categoryId: 'cat-food',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.title).toBe('Lunch')
  })

  it('exposes over-budget remaining and percentage values', () => {
    const presentation = presentCategoryBudgetStat({
      categoryId: 'cat-food',
      categoryName: 'Food',
      allocatedMinor: 5000,
      spentMinor: 5800,
      remainingMinor: -800,
      percentageUsed: 1.16,
      status: 'over_budget',
    })
    expect(presentation.isOverBudget).toBe(true)
    expect(presentation.overBudgetMinor).toBe(800)
    expect(presentation.remainingDisplayMinor).toBe(0)
    expect(presentation.percentageSpent).toBe(116)
  })

  it('starts a new financial period with zero eligible spending', () => {
    const plan = makePlan({
      id: 'plan-1',
      name: 'Plan',
      effectiveFrom: '2026-06-01',
    })
    const categories = [makeCategory({ id: 'cat-food', name: 'Food' })]
    const allocations = [
      makeAllocation({
        id: 'alloc-1',
        budgetPlanId: 'plan-1',
        categoryId: 'cat-food',
        allocatedAmountMinor: 10_000,
      }),
    ]
    const transactions = [
      makeExpense({
        id: 'tx-old',
        title: 'Prior period',
        accountId: 'acc-1',
        categoryId: 'cat-food',
        originalAmountMinor: 4000,
        baseCurrencyAmountMinor: 4000,
        date: '2026-06-20',
        treatmentId: 'treat-monthly',
      }),
    ]

    const view = buildMonthlyStatsView({
      financialPeriodStartDay: 1,
      plans: [plan],
      allocationsByPlanId: { 'plan-1': allocations },
      categories,
      transactions,
      treatments,
      today: '2026-07-05',
    })

    expect(view.period.start).toBe('2026-07-01')
    expect(view.stats.totalSpentMinor).toBe(0)
    expect(view.categories[0]?.spentMinor).toBe(0)
  })
})
