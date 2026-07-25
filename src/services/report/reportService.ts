import {
  buildCategoryStats,
  selectBudgetPlanForDate,
  sumAllocations,
  sumEligibleSpentMinor,
} from '@/services/budget'
import { subMinor } from '@/services/money'
import type { FinancialPeriod } from '@/services/period'
import type {
  BudgetAllocation,
  BudgetPlan,
  Category,
  CategorySnapshot,
  PeriodReport,
  Transaction,
  Treatment,
} from '@/domain/types'
import type { FinancialDate } from '@/utils/dates'

export interface BuildPeriodReportInput {
  id: string
  period: FinancialPeriod
  plans: BudgetPlan[]
  allocationsByPlanId: Record<string, BudgetAllocation[]>
  categories: Category[]
  transactions: Transaction[]
  treatments: Treatment[]
  baseCurrencyCode: string
  closedAt?: string | null
  createdAt: string
  updatedAt: string
}

/**
 * Build a period report from transactions + the budget version effective at period start.
 * Snapshot freezes category display names and amounts for historical stability.
 * Omits an active-period `today` filter so all eligible expenses through period end are included.
 */
export function buildPeriodReport(input: BuildPeriodReportInput): PeriodReport {
  const budgetPlan = selectBudgetPlanForDate(input.plans, input.period.start)
  const allocations =
    budgetPlan != null ? (input.allocationsByPlanId[budgetPlan.id] ?? []) : []

  const totalSpentMinor = sumEligibleSpentMinor(
    input.transactions,
    input.treatments,
    { period: input.period },
  )

  const categoryStats = buildCategoryStats({
    categories: input.categories,
    allocations,
    transactions: input.transactions,
    treatments: input.treatments,
    period: input.period,
  })

  const snapshotData: CategorySnapshot[] = categoryStats.map((row) => ({
    categoryId: row.categoryId,
    categoryDisplayName: row.categoryName,
    allocatedAmountMinor: row.allocatedMinor,
    spentAmountMinor: row.spentMinor,
    remainingAmountMinor: row.remainingMinor,
    percentageUsed: row.percentageUsed,
  }))

  const totalBudgetMinor = sumAllocations(allocations)

  return {
    id: input.id,
    periodStart: input.period.start,
    periodEnd: input.period.end,
    budgetPlanId: budgetPlan?.id ?? null,
    baseCurrencyCode: input.baseCurrencyCode,
    totalBudgetMinor,
    totalSpentMinor,
    remainingMinor: subMinor(totalBudgetMinor, totalSpentMinor),
    closedAt: input.closedAt ?? null,
    snapshotData,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  }
}

/**
 * Reconstruct report totals from a frozen snapshot (stable after budget changes).
 */
export function totalsFromSnapshot(report: PeriodReport): {
  totalBudgetMinor: number
  totalSpentMinor: number
  remainingMinor: number
} {
  return {
    totalBudgetMinor: report.totalBudgetMinor,
    totalSpentMinor: report.totalSpentMinor,
    remainingMinor: report.remainingMinor,
  }
}

export interface CustomRangeReport {
  start: FinancialDate
  end: FinancialDate
  totalSpentMinor: number
  categories: ReturnType<typeof buildCategoryStats>
  matchingTransactionIds: string[]
}

export function buildCustomRangeReport(input: {
  start: FinancialDate
  end: FinancialDate
  categories: Category[]
  allocations: BudgetAllocation[]
  transactions: Transaction[]
  treatments: Treatment[]
}): CustomRangeReport {
  const period: FinancialPeriod = { start: input.start, end: input.end }
  const categories = buildCategoryStats({
    categories: input.categories,
    allocations: input.allocations,
    transactions: input.transactions,
    treatments: input.treatments,
    period,
  })

  const totalSpentMinor = sumEligibleSpentMinor(
    input.transactions,
    input.treatments,
    { period },
  )

  const matchingTransactionIds = input.transactions
    .filter((tx) => {
      if (tx.deletedAt != null) return false
      return tx.date >= input.start && tx.date <= input.end
    })
    .map((tx) => tx.id)

  return {
    start: input.start,
    end: input.end,
    totalSpentMinor,
    categories,
    matchingTransactionIds,
  }
}

/**
 * Closed reports should be read via snapshot/totals fields, not recomputed from current plans.
 */
export function reportUsesFrozenSnapshot(report: PeriodReport): boolean {
  return report.closedAt != null
}
