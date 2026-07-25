import Dexie, { type EntityTable } from 'dexie'
import { DB_NAME } from '@/config/app'
import type {
  Account,
  BudgetAllocation,
  BudgetPlan,
  Category,
  Currency,
  ExchangeRate,
  Fund,
  PeriodReport,
  TitleSuggestion,
  Transaction,
  Treatment,
  UserSettings,
} from '@/domain/types'

const V1_STORES = {
  settings: 'id',
  currencies: 'code, active',
  accounts: 'id, isActive, archivedAt, sortOrder, currencyCode',
  categories: 'id, kind, isActive, isFavorite, archivedAt, parentCategoryId',
  funds: 'id, isActive, isDefault, archivedAt',
  treatments: 'id, behaviorKey, isSystem, isActive',
  transactions:
    'id, date, accountId, categoryId, fundId, treatmentId, transactionType, linkedTransferId, deletedAt, normalizedTitle, [date+transactionType]',
  budgetPlans: 'id, effectiveFrom, effectiveTo, isActive',
  budgetAllocations: 'id, budgetPlanId, categoryId',
  periodReports: 'id, periodStart, periodEnd, closedAt',
  titleSuggestions: 'normalizedTitle, lastUsedAt, useCount',
} as const

export class MyFinanceDatabase extends Dexie {
  settings!: EntityTable<UserSettings, 'id'>
  currencies!: EntityTable<Currency, 'code'>
  accounts!: EntityTable<Account, 'id'>
  categories!: EntityTable<Category, 'id'>
  funds!: EntityTable<Fund, 'id'>
  treatments!: EntityTable<Treatment, 'id'>
  transactions!: EntityTable<Transaction, 'id'>
  budgetPlans!: EntityTable<BudgetPlan, 'id'>
  budgetAllocations!: EntityTable<BudgetAllocation, 'id'>
  periodReports!: EntityTable<PeriodReport, 'id'>
  titleSuggestions!: EntityTable<TitleSuggestion, 'normalizedTitle'>
  exchangeRates!: EntityTable<ExchangeRate, 'id'>

  constructor() {
    super(DB_NAME)

    // Keep v1 declaration so existing installs upgrade additively (no data wipe).
    this.version(1).stores({ ...V1_STORES })

    this.version(2).stores({
      ...V1_STORES,
      exchangeRates: 'id, baseCurrencyCode, quoteCurrencyCode, updatedAt',
    })
  }
}

export const db = new MyFinanceDatabase()
