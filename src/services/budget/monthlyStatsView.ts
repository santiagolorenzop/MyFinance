import {
  calculatePeriodBudgetStats,
  isBudgetEligibleExpense,
  selectBudgetPlanForDate,
  type CategoryBudgetStat,
  type CategoryBudgetStatus,
  type PeriodBudgetStats,
} from '@/services/budget/budgetService'
import { compareMinor, negateMinor } from '@/services/money'
import {
  daysLeftInPeriod,
  getPeriodForDate,
  isEligibleForActiveSpent,
  type FinancialPeriod,
} from '@/services/period'
import type {
  BudgetAllocation,
  BudgetPlan,
  Category,
  Transaction,
  Treatment,
} from '@/domain/types'
import { todayFinancialDate, type FinancialDate } from '@/utils/dates'

/** Presentation fields derived from CategoryBudgetStat (no React math). */
export interface CategoryBudgetPresentation {
  categoryId: string
  categoryName: string
  allocatedMinor: number
  spentMinor: number
  /** Engine remaining (negative when over budget). */
  remainingMinor: number
  /** Non-negative remaining for within-budget display. */
  remainingDisplayMinor: number
  /** Amount over budget when over; otherwise 0. */
  overBudgetMinor: number
  isOverBudget: boolean
  percentageUsed: number | null
  /** Whole-number percent spent for display (e.g. 56, 116). */
  percentageSpent: number | null
  status: CategoryBudgetStatus
  progressRatio: number | null
}

export interface MonthlyStatsViewModel {
  period: FinancialPeriod
  today: FinancialDate
  stats: PeriodBudgetStats
  categories: CategoryBudgetPresentation[]
  hasBudgetPlan: boolean
}

/**
 * Map a budget category stat into display-ready amounts/percentages.
 */
export function presentCategoryBudgetStat(
  stat: CategoryBudgetStat,
): CategoryBudgetPresentation {
  const isOverBudget =
    stat.status === 'over_budget' || compareMinor(stat.remainingMinor, 0) < 0
  const overBudgetMinor =
    compareMinor(stat.remainingMinor, 0) < 0
      ? negateMinor(stat.remainingMinor)
      : 0
  const remainingDisplayMinor =
    compareMinor(stat.remainingMinor, 0) > 0 ? stat.remainingMinor : 0
  const percentageSpent =
    stat.percentageUsed == null
      ? null
      : Math.round(stat.percentageUsed * 100)

  return {
    categoryId: stat.categoryId,
    categoryName: stat.categoryName,
    allocatedMinor: stat.allocatedMinor,
    spentMinor: stat.spentMinor,
    remainingMinor: stat.remainingMinor,
    remainingDisplayMinor,
    overBudgetMinor,
    isOverBudget,
    percentageUsed: stat.percentageUsed,
    percentageSpent,
    status: stat.status,
    progressRatio: stat.percentageUsed,
  }
}

/**
 * Compose active monthly statistics from ledger + budget services (no new formulas).
 */
export function buildMonthlyStatsView(input: {
  financialPeriodStartDay: number
  plans: BudgetPlan[]
  allocationsByPlanId: Record<string, BudgetAllocation[]>
  categories: Category[]
  transactions: Transaction[]
  treatments: Treatment[]
  today?: FinancialDate
}): MonthlyStatsViewModel {
  const today = input.today ?? todayFinancialDate()
  const period = getPeriodForDate(input.financialPeriodStartDay, today)
  const budgetPlan = selectBudgetPlanForDate(input.plans, today)
  const allocations =
    budgetPlan != null ? (input.allocationsByPlanId[budgetPlan.id] ?? []) : []
  const daysLeft = daysLeftInPeriod(period, today)

  const stats = calculatePeriodBudgetStats({
    period,
    daysLeft,
    budgetPlan,
    allocations,
    categories: input.categories,
    transactions: input.transactions,
    treatments: input.treatments,
    today,
  })

  return {
    period,
    today,
    stats,
    categories: stats.categories.map(presentCategoryBudgetStat),
    hasBudgetPlan: budgetPlan != null,
  }
}

export function findCategoryStat(
  stats: PeriodBudgetStats,
  categoryId: string,
): CategoryBudgetStat | null {
  return stats.categories.find((row) => row.categoryId === categoryId) ?? null
}

export function findCategoryPresentation(
  view: MonthlyStatsViewModel,
  categoryId: string,
): CategoryBudgetPresentation | null {
  return view.categories.find((row) => row.categoryId === categoryId) ?? null
}

/** Active-period expense rows for a category (reuses budget eligibility rules). */
export function categoryPeriodTransactions(input: {
  transactions: Transaction[]
  treatments: Treatment[]
  period: FinancialPeriod
  today: FinancialDate
  categoryId: string
}): Transaction[] {
  const byTreatment = new Map(input.treatments.map((row) => [row.id, row]))

  return input.transactions
    .filter((tx) => {
      if (!isBudgetEligibleExpense(tx, byTreatment)) return false
      if (tx.categoryId !== input.categoryId) return false
      return isEligibleForActiveSpent(tx.date, input.period, input.today)
    })
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
}
