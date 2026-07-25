import { db } from '@/db'
import { assertBudgetPlansDoNotOverlap } from '@/services/budget'
import { budgetAllocationSchema, budgetPlanSchema } from '@/domain/schemas'
import type { BudgetAllocation, BudgetPlan } from '@/domain/types'
import { addCalendarDays, todayFinancialDate } from '@/utils/dates'

export interface BudgetAllocationInput {
  categoryId: string
  allocatedAmountMinor: number
}

export async function listBudgetPlans(): Promise<BudgetPlan[]> {
  const plans = await db.budgetPlans.toArray()
  return plans.sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
}

export async function listAllocations(budgetPlanId: string): Promise<BudgetAllocation[]> {
  return db.budgetAllocations.where('budgetPlanId').equals(budgetPlanId).toArray()
}

/**
 * Create a new budget version. Closes any previous open-ended plan the day before
 * `effectiveFrom` so ranges do not overlap (Phase 2 overlap rule).
 */
export async function createBudgetPlan(input: {
  name: string
  baseCurrencyCode: string
  effectiveFrom?: string
  allocations: BudgetAllocationInput[]
}): Promise<{ plan: BudgetPlan; allocations: BudgetAllocation[] }> {
  const now = new Date().toISOString()
  const effectiveFrom = input.effectiveFrom ?? todayFinancialDate()
  const planId = crypto.randomUUID()

  const plan = budgetPlanSchema.parse({
    id: planId,
    name: input.name.trim() || 'Monthly budget',
    baseCurrencyCode: input.baseCurrencyCode,
    effectiveFrom,
    effectiveTo: null,
    financialPeriodStartDay: null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  })

  const allocations = input.allocations.map((row, index) =>
    budgetAllocationSchema.parse({
      id: crypto.randomUUID(),
      budgetPlanId: planId,
      categoryId: row.categoryId,
      allocatedAmountMinor: row.allocatedAmountMinor,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    }),
  )

  await db.transaction('rw', db.budgetPlans, db.budgetAllocations, async () => {
    const existing = await db.budgetPlans.toArray()
    const closedTo = addCalendarDays(effectiveFrom, -1)

    const updatedExisting = existing.map((row) => {
      if (row.effectiveTo != null) return row
      if (row.effectiveFrom >= effectiveFrom) {
        throw new Error('A budget version already starts on or after this date.')
      }
      return budgetPlanSchema.parse({
        ...row,
        effectiveTo: closedTo,
        updatedAt: now,
      })
    })

    assertBudgetPlansDoNotOverlap([...updatedExisting, plan])

    for (const row of updatedExisting) {
      const prior = existing.find((item) => item.id === row.id)
      if (prior && prior.effectiveTo !== row.effectiveTo) {
        await db.budgetPlans.put(row)
      }
    }

    await db.budgetPlans.add(plan)
    if (allocations.length > 0) {
      await db.budgetAllocations.bulkAdd(allocations)
    }
  })

  return { plan, allocations }
}

export async function updateBudgetPlanName(id: string, name: string): Promise<BudgetPlan> {
  const existing = await db.budgetPlans.get(id)
  if (!existing) throw new Error('Budget plan not found')
  const next = budgetPlanSchema.parse({
    ...existing,
    name: name.trim(),
    updatedAt: new Date().toISOString(),
  })
  await db.budgetPlans.put(next)
  return next
}

export async function replaceAllocations(
  budgetPlanId: string,
  allocations: BudgetAllocationInput[],
): Promise<BudgetAllocation[]> {
  const plan = await db.budgetPlans.get(budgetPlanId)
  if (!plan) throw new Error('Budget plan not found')
  const now = new Date().toISOString()
  const rows = allocations.map((row, index) =>
    budgetAllocationSchema.parse({
      id: crypto.randomUUID(),
      budgetPlanId,
      categoryId: row.categoryId,
      allocatedAmountMinor: row.allocatedAmountMinor,
      sortOrder: index,
      createdAt: now,
      updatedAt: now,
    }),
  )

  await db.transaction('rw', db.budgetAllocations, async () => {
    await db.budgetAllocations.where('budgetPlanId').equals(budgetPlanId).delete()
    if (rows.length > 0) await db.budgetAllocations.bulkAdd(rows)
  })

  return rows
}
