import { describe, expect, it } from 'vitest'
import {
  buildPeriodReport,
  reportUsesFrozenSnapshot,
  totalsFromSnapshot,
} from '@/services/report'
import {
  makeAllocation,
  makeCategory,
  makeExpense,
  makePlan,
  treatments,
} from '@/test/fixtures/engineFixtures'

describe('reportService', () => {
  it('keeps historical report stable after a new budget version', () => {
    const period = { start: '2026-06-16', end: '2026-07-15' }
    const oldPlan = makePlan({
      id: 'plan-old',
      name: 'Old',
      effectiveFrom: '2026-01-01',
      effectiveTo: '2026-07-15',
    })
    const categories = [makeCategory({ id: 'cat-food', name: 'Food' })]
    const oldAllocations = [
      makeAllocation({
        id: 'al-old',
        budgetPlanId: 'plan-old',
        categoryId: 'cat-food',
        allocatedAmountMinor: 20000,
      }),
    ]
    const txs = [
      makeExpense({
        id: 'e1',
        title: 'Dinner',
        accountId: 'acc-1',
        categoryId: 'cat-food',
        originalAmountMinor: 5000,
        date: '2026-07-01',
      }),
    ]

    const closed = buildPeriodReport({
      id: 'report-1',
      period,
      plans: [oldPlan],
      allocationsByPlanId: { 'plan-old': oldAllocations },
      categories,
      transactions: txs,
      treatments,
      baseCurrencyCode: 'USD',
      closedAt: '2026-07-16T00:00:00.000Z',
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    })

    expect(closed.totalBudgetMinor).toBe(20000)
    expect(closed.totalSpentMinor).toBe(5000)
    expect(closed.snapshotData[0]?.allocatedAmountMinor).toBe(20000)

    // Later a new plan changes allocations — frozen report must not change.
    const newPlan = makePlan({
      id: 'plan-new',
      name: 'New',
      effectiveFrom: '2026-07-16',
      effectiveTo: null,
    })
    const recomputedForNewWorld = buildPeriodReport({
      id: 'report-2',
      period,
      plans: [
        { ...oldPlan, effectiveTo: '2026-07-15' },
        newPlan,
      ],
      allocationsByPlanId: {
        'plan-old': oldAllocations,
        'plan-new': [
          makeAllocation({
            id: 'al-new',
            budgetPlanId: 'plan-new',
            categoryId: 'cat-food',
            allocatedAmountMinor: 999999,
          }),
        ],
      },
      categories,
      transactions: txs,
      treatments,
      baseCurrencyCode: 'USD',
      closedAt: null,
      createdAt: '2026-07-20T00:00:00.000Z',
      updatedAt: '2026-07-20T00:00:00.000Z',
    })

    // Historical closed snapshot totals remain as stored.
    expect(totalsFromSnapshot(closed)).toEqual({
      totalBudgetMinor: 20000,
      totalSpentMinor: 5000,
      remainingMinor: 15000,
    })
    // Rebuilding the same period still selects the old plan by effective date.
    expect(recomputedForNewWorld.budgetPlanId).toBe('plan-old')
    expect(recomputedForNewWorld.totalBudgetMinor).toBe(20000)
    expect(reportUsesFrozenSnapshot(closed)).toBe(true)
    expect(reportUsesFrozenSnapshot(recomputedForNewWorld)).toBe(false)
  })
})
