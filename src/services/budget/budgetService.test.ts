import { describe, expect, it } from 'vitest'
import {
  assertBudgetPlansDoNotOverlap,
  buildCategoryStats,
  calculatePeriodBudgetStats,
  selectBudgetPlanForDate,
  sumEligibleSpentMinor,
} from '@/services/budget'
import { daysLeftInPeriod, getPeriodForDate } from '@/services/period'
import {
  makeAllocation,
  makeCategory,
  makeExpense,
  makePlan,
  treatments,
} from '@/test/fixtures/engineFixtures'
import { createTransferLegs, upsertTransferInLedger } from '@/services/transfer'

describe('budgetService', () => {
  const food = makeCategory({ id: 'cat-food', name: 'Food' })
  const transport = makeCategory({ id: 'cat-transport', name: 'Transportation' })
  const period = getPeriodForDate(16, '2026-07-20') // 2026-07-16 .. 2026-08-15

  const monthlyExpense = (id: string, amount: number, categoryId: string, date: string) =>
    makeExpense({
      id,
      title: id,
      accountId: 'acc-1',
      originalAmountMinor: amount,
      categoryId,
      date,
      treatmentId: 'treat-monthly',
    })

  it('includes Monthly Budget expenses in monthly spending', () => {
    const spent = sumEligibleSpentMinor(
      [monthlyExpense('e1', 2500, 'cat-food', '2026-07-18')],
      treatments,
      { period, today: '2026-07-20' },
    )
    expect(spent).toBe(2500)
  })

  it('excludes Excluded and First Month Extra expenses from monthly spending', () => {
    const spent = sumEligibleSpentMinor(
      [
        makeExpense({
          id: 'e1',
          title: 'Gift',
          accountId: 'acc-1',
          originalAmountMinor: 5000,
          categoryId: 'cat-food',
          date: '2026-07-18',
          treatmentId: 'treat-excluded',
        }),
        makeExpense({
          id: 'e2',
          title: 'Setup',
          accountId: 'acc-1',
          originalAmountMinor: 8000,
          categoryId: 'cat-food',
          date: '2026-07-18',
          treatmentId: 'treat-first-month',
        }),
      ],
      treatments,
      { period, today: '2026-07-20' },
    )
    expect(spent).toBe(0)
  })

  it('excludes expenses missing base-currency conversion from monthly spending', () => {
    const spent = sumEligibleSpentMinor(
      [
        makeExpense({
          id: 'e1',
          title: 'Taxi',
          accountId: 'acc-1',
          originalAmountMinor: 15000,
          originalCurrencyCode: 'COP',
          accountCurrencyCode: 'COP',
          accountAmountMinor: 15000,
          baseCurrencyAmountMinor: null,
          categoryId: 'cat-food',
          date: '2026-07-18',
        }),
      ],
      treatments,
      { period, today: '2026-07-20' },
    )
    expect(spent).toBe(0)
  })

  it('excludes internal transfers from monthly spending', () => {
    const legs = createTransferLegs({
      transferId: 'xfer-1',
      date: '2026-07-18',
      title: 'Transfer',
      sourceAccountId: 'acc-1',
      destinationAccountId: 'acc-2',
      sourceAmountMinor: 1000,
      sourceCurrencyCode: 'USD',
      destinationAmountMinor: 1000,
      destinationCurrencyCode: 'USD',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    })
    const ledger = upsertTransferInLedger([], legs)
    const spent = sumEligibleSpentMinor(ledger, treatments, {
      period,
      today: '2026-07-20',
    })
    expect(spent).toBe(0)
  })

  it('excludes future transactions from active spent so far', () => {
    const spent = sumEligibleSpentMinor(
      [monthlyExpense('future', 9000, 'cat-food', '2026-08-01')],
      treatments,
      { period, today: '2026-07-20' },
    )
    expect(spent).toBe(0)
  })

  it('calculates category totals, over-budget, zero-allocation, and unbudgeted', () => {
    const allocations = [
      makeAllocation({
        id: 'al-food',
        budgetPlanId: 'plan-1',
        categoryId: 'cat-food',
        allocatedAmountMinor: 20000,
      }),
      makeAllocation({
        id: 'al-transport',
        budgetPlanId: 'plan-1',
        categoryId: 'cat-transport',
        allocatedAmountMinor: 0,
      }),
    ]
    const txs = [
      monthlyExpense('e1', 2500, 'cat-food', '2026-07-18'),
      monthlyExpense('e2', 25000, 'cat-food', '2026-07-19'),
      monthlyExpense('e3', 1000, 'cat-other', '2026-07-19'),
    ]
    const categories = [
      food,
      transport,
      makeCategory({ id: 'cat-other', name: 'Other' }),
    ]
    const stats = buildCategoryStats({
      categories,
      allocations,
      transactions: txs,
      treatments,
      period,
      today: '2026-07-20',
    })

    const foodStat = stats.find((s) => s.categoryId === 'cat-food')!
    expect(foodStat.spentMinor).toBe(27500)
    expect(foodStat.remainingMinor).toBe(-7500)
    expect(foodStat.status).toBe('over_budget')
    expect(foodStat.percentageUsed).toBeGreaterThan(1)

    const transportStat = stats.find((s) => s.categoryId === 'cat-transport')!
    expect(transportStat.status).toBe('no_allocation')

    const otherStat = stats.find((s) => s.categoryId === 'cat-other')!
    expect(otherStat.status).toBe('unbudgeted')
    expect(otherStat.percentageUsed).toBeNull()
  })

  it('selects budget version by effective date', () => {
    const plans = [
      makePlan({
        id: 'plan-old',
        name: 'Old',
        effectiveFrom: '2026-01-01',
        effectiveTo: '2026-06-30',
      }),
      makePlan({
        id: 'plan-new',
        name: 'New',
        effectiveFrom: '2026-07-01',
        effectiveTo: null,
      }),
    ]
    expect(selectBudgetPlanForDate(plans, '2026-06-15')?.id).toBe('plan-old')
    expect(selectBudgetPlanForDate(plans, '2026-07-20')?.id).toBe('plan-new')
  })

  it('rejects overlapping budget versions', () => {
    expect(() =>
      assertBudgetPlansDoNotOverlap([
        makePlan({
          id: 'a',
          name: 'A',
          effectiveFrom: '2026-01-01',
          effectiveTo: '2026-06-30',
        }),
        makePlan({
          id: 'b',
          name: 'B',
          effectiveFrom: '2026-06-01',
          effectiveTo: '2026-12-31',
        }),
      ]),
    ).toThrow(/overlap/i)
  })

  it('builds period stats with days left as a number', () => {
    const plan = makePlan({
      id: 'plan-1',
      name: 'July',
      effectiveFrom: '2026-07-01',
    })
    const stats = calculatePeriodBudgetStats({
      period,
      daysLeft: daysLeftInPeriod(period, '2026-07-20'),
      budgetPlan: plan,
      allocations: [
        makeAllocation({
          id: 'al-1',
          budgetPlanId: 'plan-1',
          categoryId: 'cat-food',
          allocatedAmountMinor: 20000,
        }),
      ],
      categories: [food],
      transactions: [monthlyExpense('e1', 2500, 'cat-food', '2026-07-18')],
      treatments,
      today: '2026-07-20',
    })
    expect(stats.totalBudgetMinor).toBe(20000)
    expect(stats.totalSpentMinor).toBe(2500)
    expect(stats.remainingMinor).toBe(17500)
    expect(stats.daysLeft).toBe(27)
    expect(Number.isInteger(stats.daysLeft)).toBe(true)
  })
})
