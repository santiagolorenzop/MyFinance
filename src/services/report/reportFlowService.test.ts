import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { createAccount } from '@/repositories/accountsRepository'
import { createBudgetPlan, createCategory } from '@/repositories'
import { updateSettings } from '@/repositories/settingsRepository'
import { saveExpenseFlow } from '@/services/expense'
import {
  closePeriodReportFlow,
  ensureMissingClosedPeriodSnapshots,
  listClosedReports,
} from '@/services/report'
import { getPeriodForDate } from '@/services/period'
import { listBudgetPlans, listAllocations } from '@/repositories/budgetsRepository'

describe('reportFlowService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  async function seedJuneExpense() {
    await updateSettings({ financialPeriodStartDay: 1, baseCurrency: 'USD' })
    const account = await createAccount({
      name: 'Checking',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 0,
      isDefault: true,
    })
    const category = await createCategory({ name: 'Food', kind: 'expense' })
    await createBudgetPlan({
      name: 'Plan',
      baseCurrencyCode: 'USD',
      effectiveFrom: '2026-06-01',
      allocations: [{ categoryId: category.id, allocatedAmountMinor: 20_000 }],
    })

    const settings = await db.settings.toCollection().first()
    const treatmentId = settings?.defaultTreatmentId
    if (!treatmentId) throw new Error('missing treatment')

    const now = new Date().toISOString()
    await saveExpenseFlow({
      date: '2026-06-15',
      title: 'Groceries',
      accountId: account.id,
      categoryId: category.id,
      treatmentId,
      originalAmountMinor: 3000,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: now,
      updatedAt: now,
    })

    return { category }
  }

  it('closes a period report with a frozen snapshot', async () => {
    await seedJuneExpense()

    const period = getPeriodForDate(1, '2026-06-20')
    const closed = await closePeriodReportFlow({ period })
    expect(closed.ok).toBe(true)
    if (!closed.ok) return

    expect(closed.report.closedAt).not.toBeNull()
    expect(closed.report.totalSpentMinor).toBe(3000)
    expect(closed.report.snapshotData.length).toBeGreaterThan(0)

    const listed = await listClosedReports()
    expect(listed).toHaveLength(1)
    expect(listed[0]?.id).toBe(closed.report.id)
  })

  it('creates missing completed-period snapshots exactly once', async () => {
    await seedJuneExpense()

    const first = await ensureMissingClosedPeriodSnapshots(new Date('2026-07-10T12:00:00.000Z'))
    expect(first.created).toBeGreaterThanOrEqual(1)

    const afterFirst = await listClosedReports()
    expect(afterFirst.length).toBeGreaterThanOrEqual(1)
    const ids = afterFirst.map((row) => row.id).sort()

    const second = await ensureMissingClosedPeriodSnapshots(new Date('2026-07-10T12:00:00.000Z'))
    expect(second.created).toBe(0)
    expect(second.alreadyClosed).toBeGreaterThanOrEqual(1)

    const afterSecond = await listClosedReports()
    expect(afterSecond.map((row) => row.id).sort()).toEqual(ids)
  })

  it('keeps frozen snapshots unchanged after later budget edits', async () => {
    const { category } = await seedJuneExpense()
    const period = getPeriodForDate(1, '2026-06-20')
    const closed = await closePeriodReportFlow({ period })
    expect(closed.ok).toBe(true)
    if (!closed.ok) return

    const frozenSpent = closed.report.totalSpentMinor
    const frozenBudget = closed.report.totalBudgetMinor
    const frozenSnapshot = structuredClone(closed.report.snapshotData)

    const plans = await listBudgetPlans()
    const plan = plans[0]
    if (!plan) throw new Error('missing plan')
    const allocations = await listAllocations(plan.id)
    const allocation = allocations.find((row) => row.categoryId === category.id)
    if (!allocation) throw new Error('missing allocation')
    await db.budgetAllocations.put({
      ...allocation,
      allocatedAmountMinor: 99_000,
      updatedAt: new Date().toISOString(),
    })

    const again = await closePeriodReportFlow({ period })
    expect(again.ok).toBe(true)
    if (!again.ok) return
    expect(again.report.id).toBe(closed.report.id)
    expect(again.report.totalSpentMinor).toBe(frozenSpent)
    expect(again.report.totalBudgetMinor).toBe(frozenBudget)
    expect(again.report.snapshotData).toEqual(frozenSnapshot)
  })
})
