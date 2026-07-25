import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import {
  createBudgetPlan,
  createCategory,
  listAllocations,
  listBudgetPlans,
  replaceAllocations,
} from '@/repositories'
import { buildMonthlyStatsView } from '@/services/budget'
import { listTreatments } from '@/repositories/treatmentsRepository'

describe('budgetsRepository versioning', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  it('closes the previous open-ended plan when creating a new version', async () => {
    const food = await createCategory({ name: 'Food', kind: 'expense' })
    await createBudgetPlan({
      name: 'v1',
      baseCurrencyCode: 'USD',
      effectiveFrom: '2026-01-01',
      allocations: [{ categoryId: food.id, allocatedAmountMinor: 10000 }],
    })
    await createBudgetPlan({
      name: 'v2',
      baseCurrencyCode: 'USD',
      effectiveFrom: '2026-07-01',
      allocations: [{ categoryId: food.id, allocatedAmountMinor: 20000 }],
    })

    const plans = await listBudgetPlans()
    const v1 = plans.find((p) => p.name === 'v1')
    const v2 = plans.find((p) => p.name === 'v2')
    expect(v1?.effectiveTo).toBe('2026-06-30')
    expect(v2?.effectiveTo).toBeNull()
  })

  it('updates current plan allocations immediately via replaceAllocations', async () => {
    const food = await createCategory({ name: 'Food', kind: 'expense' })
    const transport = await createCategory({ name: 'Transport', kind: 'expense' })
    const { plan } = await createBudgetPlan({
      name: 'Current',
      baseCurrencyCode: 'USD',
      effectiveFrom: '2026-07-01',
      allocations: [{ categoryId: food.id, allocatedAmountMinor: 10_000 }],
    })

    await replaceAllocations(plan.id, [
      { categoryId: food.id, allocatedAmountMinor: 15_000 },
      { categoryId: transport.id, allocatedAmountMinor: 5_000 },
    ])

    const rows = await listAllocations(plan.id)
    expect(rows).toHaveLength(2)
    expect(rows.find((row) => row.categoryId === food.id)?.allocatedAmountMinor).toBe(15_000)
    expect(rows.find((row) => row.categoryId === transport.id)?.allocatedAmountMinor).toBe(
      5_000,
    )

    const plans = await listBudgetPlans()
    const treatments = await listTreatments()
    const view = buildMonthlyStatsView({
      financialPeriodStartDay: 1,
      plans,
      allocationsByPlanId: { [plan.id]: rows },
      categories: [food, transport],
      transactions: [],
      treatments,
      today: '2026-07-20',
    })
    expect(view.stats.totalBudgetMinor).toBe(20_000)
    expect(view.categories.find((row) => row.categoryId === food.id)?.allocatedMinor).toBe(
      15_000,
    )
  })
})
