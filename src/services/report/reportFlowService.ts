import {
  buildCustomRangeReport,
  buildPeriodReport,
  reportUsesFrozenSnapshot,
  totalsFromSnapshot,
  type CustomRangeReport,
} from '@/services/report/reportService'
import { getPeriodForDate, type FinancialPeriod } from '@/services/period'
import { selectBudgetPlanForDate } from '@/services/budget'
import { db } from '@/db'
import { listBudgetPlans, listAllocations } from '@/repositories/budgetsRepository'
import { listCategories } from '@/repositories/categoriesRepository'
import { getSettings } from '@/repositories/settingsRepository'
import { listAllTransactions } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import {
  getPeriodReportByRange,
  listPeriodReports,
  savePeriodReport,
} from '@/repositories/reportsRepository'
import type { BudgetAllocation, PeriodReport } from '@/domain/types'
import { addCalendarDays, todayFinancialDate, type FinancialDate } from '@/utils/dates'

async function loadAllocationsByPlanId(
  planIds: string[],
): Promise<Record<string, BudgetAllocation[]>> {
  const map: Record<string, BudgetAllocation[]> = {}
  await Promise.all(
    planIds.map(async (planId) => {
      map[planId] = await listAllocations(planId)
    }),
  )
  return map
}

/**
 * Persist a closed period report built via reportService (snapshot frozen at close).
 */
export async function closePeriodReportFlow(input: {
  period: FinancialPeriod
}): Promise<{ ok: true; report: PeriodReport } | { ok: false; error: string }> {
  const existing = await getPeriodReportByRange(input.period.start, input.period.end)
  if (existing?.closedAt != null) {
    return { ok: true, report: existing }
  }

  const [settings, plans, categories, transactions, treatments] = await Promise.all([
    getSettings(),
    listBudgetPlans(),
    listCategories(true),
    listAllTransactions(true),
    listTreatments(),
  ])

  if (!settings) {
    return { ok: false, error: 'Settings not initialized' }
  }

  const allocationsByPlanId = await loadAllocationsByPlanId(plans.map((plan) => plan.id))
  const now = new Date().toISOString()

  const report = buildPeriodReport({
    id: existing?.id ?? crypto.randomUUID(),
    period: input.period,
    plans,
    allocationsByPlanId,
    categories,
    transactions,
    treatments,
    baseCurrencyCode: settings.baseCurrency,
    closedAt: now,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  })

  try {
    await db.transaction('rw', db.periodReports, async () => {
      await savePeriodReport(report)
    })
  } catch {
    return { ok: false, error: 'Could not save period report.' }
  }

  return { ok: true, report }
}

export async function closePreviousPeriodFlow(now: Date = new Date()): Promise<
  { ok: true; report: PeriodReport | null; reason?: 'still_current' } | { ok: false; error: string }
> {
  const settings = await getSettings()
  if (!settings) return { ok: false, error: 'Settings not initialized' }

  const today = todayFinancialDate(now)
  const current = getPeriodForDate(settings.financialPeriodStartDay, today)
  const dayBefore = addCalendarDays(current.start, -1)
  const previous = getPeriodForDate(settings.financialPeriodStartDay, dayBefore)
  if (previous.start === current.start) {
    return { ok: true, report: null, reason: 'still_current' }
  }

  return closePeriodReportFlow({ period: previous })
}

/**
 * Create frozen snapshots for completed periods that do not yet have one.
 * Idempotent: existing closed snapshots are left untouched.
 */
export async function ensureMissingClosedPeriodSnapshots(
  now: Date = new Date(),
): Promise<{ created: number; alreadyClosed: number }> {
  const settings = await getSettings()
  if (!settings) return { created: 0, alreadyClosed: 0 }

  const today = todayFinancialDate(now)
  const current = getPeriodForDate(settings.financialPeriodStartDay, today)
  const dayBeforeCurrent = addCalendarDays(current.start, -1)
  const previous = getPeriodForDate(settings.financialPeriodStartDay, dayBeforeCurrent)
  if (previous.start === current.start) {
    return { created: 0, alreadyClosed: 0 }
  }

  const [transactions, existingReports] = await Promise.all([
    listAllTransactions(true),
    listPeriodReports(),
  ])

  let earliest = previous.start
  for (const tx of transactions) {
    if (tx.deletedAt != null) continue
    if (tx.date < earliest) earliest = tx.date
  }
  for (const report of existingReports) {
    if (report.periodStart < earliest) earliest = report.periodStart
  }

  const periods: FinancialPeriod[] = []
  let cursor = earliest
  while (true) {
    const period = getPeriodForDate(settings.financialPeriodStartDay, cursor)
    if (period.start >= current.start) break
    if (!periods.some((row) => row.start === period.start)) {
      periods.push(period)
    }
    const nextStart = addCalendarDays(period.end, 1)
    if (nextStart >= current.start) break
    cursor = nextStart
  }

  if (!periods.some((row) => row.start === previous.start)) {
    periods.push(previous)
  }

  periods.sort((a, b) => a.start.localeCompare(b.start))

  let created = 0
  let alreadyClosed = 0
  for (const period of periods) {
    const existing = await getPeriodReportByRange(period.start, period.end)
    if (existing?.closedAt != null) {
      alreadyClosed += 1
      continue
    }
    const result = await closePeriodReportFlow({ period })
    if (result.ok) created += 1
  }

  return { created, alreadyClosed }
}

export async function buildLiveCustomRangeReport(input: {
  start: FinancialDate
  end: FinancialDate
}): Promise<CustomRangeReport | null> {
  const [settings, plans, categories, transactions, treatments] = await Promise.all([
    getSettings(),
    listBudgetPlans(),
    listCategories(true),
    listAllTransactions(),
    listTreatments(),
  ])
  if (!settings) return null

  const plan = selectBudgetPlanForDate(plans, input.start)
  const allocations = plan ? await listAllocations(plan.id) : []

  return buildCustomRangeReport({
    start: input.start,
    end: input.end,
    categories,
    allocations,
    transactions,
    treatments,
  })
}

export async function listClosedReports(): Promise<PeriodReport[]> {
  const rows = await listPeriodReports()
  return rows.filter((row) => reportUsesFrozenSnapshot(row))
}

export { totalsFromSnapshot, reportUsesFrozenSnapshot }
