import type {
  Account,
  BudgetAllocation,
  BudgetPlan,
  Category,
  Currency,
  TitleSuggestion,
  Transaction,
  Treatment,
} from '@/domain/types'
import { normalizeTitle } from '@/services/suggestion'

export const currencies: Record<string, Currency> = {
  USD: {
    code: 'USD',
    displayName: 'US Dollar',
    symbol: '$',
    decimalPlaces: 2,
    active: true,
  },
  COP: {
    code: 'COP',
    displayName: 'Colombian Peso',
    symbol: '$',
    decimalPlaces: 0,
    active: true,
  },
}

export const treatments: Treatment[] = [
  {
    id: 'treat-monthly',
    behaviorKey: 'monthly_budget',
    displayName: 'Monthly Budget',
    description: null,
    countsTowardMonthlyBudget: true,
    countsAsAccountMovement: true,
    isTransferBehavior: false,
    isSystem: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'treat-excluded',
    behaviorKey: 'excluded',
    displayName: 'Excluded',
    description: null,
    countsTowardMonthlyBudget: false,
    countsAsAccountMovement: true,
    isTransferBehavior: false,
    isSystem: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'treat-transfer',
    behaviorKey: 'internal_transfer',
    displayName: 'Internal Transfer',
    description: null,
    countsTowardMonthlyBudget: false,
    countsAsAccountMovement: true,
    isTransferBehavior: true,
    isSystem: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'treat-first-month',
    behaviorKey: 'first_month_extra',
    displayName: 'First Month Extra',
    description: null,
    countsTowardMonthlyBudget: false,
    countsAsAccountMovement: true,
    isTransferBehavior: false,
    isSystem: true,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

export function makeAccount(
  overrides: Partial<Account> & Pick<Account, 'id' | 'name' | 'currencyCode'>,
): Account {
  return {
    type: 'checking',
    initialBalanceMinor: 0,
    initialBalanceDate: '2026-01-01',
    icon: null,
    sortOrder: 0,
    isDefault: false,
    isActive: true,
    includeInTotalNetBalance: true,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

export function makeCategory(
  overrides: Partial<Category> & Pick<Category, 'id' | 'name'>,
): Category {
  return {
    kind: 'expense',
    parentCategoryId: null,
    icon: null,
    sortOrder: 0,
    isFavorite: false,
    isActive: true,
    colorToken: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    archivedAt: null,
    ...overrides,
  }
}

export function makeExpense(
  overrides: Partial<Transaction> &
    Pick<Transaction, 'id' | 'title' | 'accountId' | 'originalAmountMinor' | 'date'>,
): Transaction {
  const title = overrides.title
  const currency = overrides.originalCurrencyCode ?? 'USD'
  const amount = overrides.originalAmountMinor
  return {
    normalizedTitle: normalizeTitle(title),
    notes: null,
    transactionType: 'expense',
    categoryId: null,
    fundId: null,
    treatmentId: 'treat-monthly',
    originalCurrencyCode: currency,
    accountAmountMinor: amount,
    accountCurrencyCode: currency,
    baseCurrencyAmountMinor: amount,
    exchangeRate: null,
    exchangeRateSource: null,
    exchangeRateDate: null,
    destinationAccountId: null,
    linkedTransferId: null,
    linkedTransactionId: null,
    entrySource: 'manual',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    deletedAt: null,
    ...overrides,
  }
}

export function makeIncome(
  overrides: Partial<Transaction> &
    Pick<Transaction, 'id' | 'title' | 'accountId' | 'originalAmountMinor' | 'date'>,
): Transaction {
  return {
    ...makeExpense(overrides),
    transactionType: 'income',
    treatmentId: 'treat-excluded',
  }
}

export function makePlan(
  overrides: Partial<BudgetPlan> & Pick<BudgetPlan, 'id' | 'name' | 'effectiveFrom'>,
): BudgetPlan {
  return {
    baseCurrencyCode: 'USD',
    effectiveTo: null,
    financialPeriodStartDay: null,
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeAllocation(
  overrides: Partial<BudgetAllocation> &
    Pick<BudgetAllocation, 'id' | 'budgetPlanId' | 'categoryId' | 'allocatedAmountMinor'>,
): BudgetAllocation {
  return {
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

export function makeSuggestion(
  overrides: Partial<TitleSuggestion> & Pick<TitleSuggestion, 'normalizedTitle'>,
): TitleSuggestion {
  return {
    originalRecentTitles: [overrides.normalizedTitle],
    mostUsedCategoryId: null,
    mostUsedAccountId: null,
    mostUsedFundId: null,
    mostUsedTreatmentId: null,
    useCount: 1,
    lastUsedAt: '2026-07-01T00:00:00.000Z',
    ...overrides,
  }
}

export type { TitleSuggestion }
