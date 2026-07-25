import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { createBudgetPlan, createCategory, listBudgetPlans } from '@/repositories'

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
})
