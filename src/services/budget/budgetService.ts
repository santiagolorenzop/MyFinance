import { NEAR_BUDGET_THRESHOLD } from '@/config/app'
import { addMinor, assertFiniteInteger, subMinor } from '@/services/money'
import {
  isDateInPeriod,
  isEligibleForActiveSpent,
  type FinancialPeriod,
} from '@/services/period'
import { compareFinancialDates, type FinancialDate } from '@/utils/dates'
import type {
  BudgetAllocation,
  BudgetPlan,
  Category,
  Transaction,
  Treatment,
} from '@/domain/types'

export type CategoryBudgetStatus =
  | 'normal'
  | 'near_limit'
  | 'over_budget'
  | 'unbudgeted'
  | 'no_allocation'

export interface CategoryBudgetStat {
  categoryId: string
  categoryName: string
  allocatedMinor: number
  spentMinor: number
  remainingMinor: number
  percentageUsed: number | null
  status: CategoryBudgetStatus
}

export interface PeriodBudgetStats {
  period: FinancialPeriod
  budgetPlan: BudgetPlan | null
  totalBudgetMinor: number
  totalSpentMinor: number
  remainingMinor: number
  daysLeft: number
  categories: CategoryBudgetStat[]
  unbudgetedSpentMinor: number
}

function treatmentById(treatments: Treatment[]): Map<string, Treatment> {
  return new Map(treatments.map((t) => [t.id, t]))
}

export function isBudgetEligibleExpense(
  tx: Transaction,
  treatments: Map<string, Treatment>,
): boolean {
  if (tx.deletedAt != null) return false
  if (tx.transactionType !== 'expense') return false
  // "No category" expenses affect balances/history but not Monthly Budget / stats.
  if (tx.categoryId == null) return false
  const treatment = treatments.get(tx.treatmentId)
  if (!treatment?.countsTowardMonthlyBudget) return false
  if (tx.baseCurrencyAmountMinor == null) return false
  return true
}

/**
 * Select the budget plan effective on a given financial date.
 * Prefers plans where effectiveFrom <= date and (effectiveTo is null or date <= effectiveTo).
 * If multiple match, pick the latest effectiveFrom.
 */
export function selectBudgetPlanForDate(
  plans: BudgetPlan[],
  onDate: FinancialDate,
): BudgetPlan | null {
  const matches = plans.filter((plan) => {
    if (compareFinancialDates(plan.effectiveFrom, onDate) > 0) return false
    if (plan.effectiveTo != null && compareFinancialDates(onDate, plan.effectiveTo) > 0) {
      return false
    }
    return true
  })

  if (matches.length === 0) return null
  matches.sort((a, b) => compareFinancialDates(b.effectiveFrom, a.effectiveFrom))
  return matches[0] ?? null
}

/**
 * Validate that budget plan effective ranges do not overlap ambiguously.
 * Overlap = two plans whose [from, to] intervals intersect.
 */
export function assertBudgetPlansDoNotOverlap(plans: BudgetPlan[]): void {
  const sorted = [...plans].sort((a, b) =>
    compareFinancialDates(a.effectiveFrom, b.effectiveFrom),
  )

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      const a = sorted[i]
      const b = sorted[j]
      const aEnd = a.effectiveTo
      const bStart = b.effectiveFrom
      // If a has no end, it overlaps everything after its start unless we treat only explicit ranges.
      if (aEnd == null) {
        throw new Error(
          `Budget plan "${a.name}" is open-ended and overlaps "${b.name}"`,
        )
      }
      if (compareFinancialDates(bStart, aEnd) <= 0) {
        throw new Error(
          `Budget plans overlap: "${a.name}" and "${b.name}"`,
        )
      }
    }
  }
}

export function sumAllocations(allocations: BudgetAllocation[]): number {
  return allocations.reduce(
    (sum, row) => addMinor(sum, assertFiniteInteger(row.allocatedAmountMinor)),
    0,
  )
}

export interface SpentOptions {
  period: FinancialPeriod
  /** When set, excludes future dates relative to today (active period mode). */
  today?: FinancialDate
  categoryId?: string | null
}

export function sumEligibleSpentMinor(
  transactions: Transaction[],
  treatments: Treatment[],
  options: SpentOptions,
): number {
  const byTreatment = treatmentById(treatments)
  let total = 0

  for (const tx of transactions) {
    if (!isBudgetEligibleExpense(tx, byTreatment)) continue

    if (options.today != null) {
      if (!isEligibleForActiveSpent(tx.date, options.period, options.today)) continue
    } else if (!isDateInPeriod(tx.date, options.period)) {
      continue
    }

    if (options.categoryId != null && tx.categoryId !== options.categoryId) continue

    total = addMinor(total, assertFiniteInteger(tx.baseCurrencyAmountMinor!))
  }

  return total
}

export function percentageUsed(
  spentMinor: number,
  allocatedMinor: number,
): number | null {
  if (allocatedMinor <= 0) return null
  return spentMinor / allocatedMinor
}

export function categoryStatus(
  allocatedMinor: number,
  spentMinor: number,
  nearThreshold = NEAR_BUDGET_THRESHOLD,
): CategoryBudgetStatus {
  if (allocatedMinor <= 0 && spentMinor > 0) return 'unbudgeted'
  if (allocatedMinor <= 0 && spentMinor === 0) return 'no_allocation'
  const pct = spentMinor / allocatedMinor
  if (pct > 1) return 'over_budget'
  if (pct >= nearThreshold) return 'near_limit'
  return 'normal'
}

export function buildCategoryStats(input: {
  categories: Category[]
  allocations: BudgetAllocation[]
  transactions: Transaction[]
  treatments: Treatment[]
  period: FinancialPeriod
  today?: FinancialDate
}): CategoryBudgetStat[] {
  const allocationByCategory = new Map(
    input.allocations.map((row) => [row.categoryId, row.allocatedAmountMinor]),
  )

  const spentByCategory = new Map<string, number>()
  const byTreatment = treatmentById(input.treatments)

  for (const tx of input.transactions) {
    if (!isBudgetEligibleExpense(tx, byTreatment)) continue
    if (input.today != null) {
      if (!isEligibleForActiveSpent(tx.date, input.period, input.today)) continue
    } else if (!isDateInPeriod(tx.date, input.period)) {
      continue
    }
    if (tx.categoryId == null) continue
    const prev = spentByCategory.get(tx.categoryId) ?? 0
    spentByCategory.set(
      tx.categoryId,
      addMinor(prev, assertFiniteInteger(tx.baseCurrencyAmountMinor!)),
    )
  }

  const categoryIds = new Set<string>([
    ...allocationByCategory.keys(),
    ...spentByCategory.keys(),
  ])

  const nameById = new Map(input.categories.map((c) => [c.id, c.name]))
  const stats: CategoryBudgetStat[] = []

  for (const categoryId of categoryIds) {
    const allocatedMinor = allocationByCategory.get(categoryId) ?? 0
    const spentMinor = spentByCategory.get(categoryId) ?? 0
    const remainingMinor = subMinor(allocatedMinor, spentMinor)
    const pct = percentageUsed(spentMinor, allocatedMinor)
    stats.push({
      categoryId,
      categoryName: nameById.get(categoryId) ?? 'Unknown',
      allocatedMinor,
      spentMinor,
      remainingMinor,
      percentageUsed: pct,
      status: categoryStatus(allocatedMinor, spentMinor),
    })
  }

  stats.sort((a, b) => a.categoryName.localeCompare(b.categoryName))
  return stats
}

export function calculatePeriodBudgetStats(input: {
  period: FinancialPeriod
  daysLeft: number
  budgetPlan: BudgetPlan | null
  allocations: BudgetAllocation[]
  categories: Category[]
  transactions: Transaction[]
  treatments: Treatment[]
  today?: FinancialDate
}): PeriodBudgetStats {
  const categories = buildCategoryStats({
    categories: input.categories,
    allocations: input.allocations,
    transactions: input.transactions,
    treatments: input.treatments,
    period: input.period,
    today: input.today,
  })

  const totalBudgetMinor = sumAllocations(input.allocations)
  const totalSpentMinor = sumEligibleSpentMinor(input.transactions, input.treatments, {
    period: input.period,
    today: input.today,
  })

  const unbudgetedSpentMinor = categories
    .filter((row) => row.status === 'unbudgeted')
    .reduce((sum, row) => addMinor(sum, row.spentMinor), 0)

  return {
    period: input.period,
    budgetPlan: input.budgetPlan,
    totalBudgetMinor,
    totalSpentMinor,
    remainingMinor: subMinor(totalBudgetMinor, totalSpentMinor),
    daysLeft: input.daysLeft,
    categories,
    unbudgetedSpentMinor,
  }
}
