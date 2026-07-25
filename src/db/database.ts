import Dexie, { type EntityTable } from 'dexie'
import { DB_NAME, SCHEMA_VERSION } from '@/config/app'
import type {
  Account,
  BudgetAllocation,
  BudgetPlan,
  Category,
  Currency,
  Fund,
  PeriodReport,
  TitleSuggestion,
  Transaction,
  Treatment,
  UserSettings,
} from '@/domain/types'

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

  constructor() {
    super(DB_NAME)

    this.version(SCHEMA_VERSION).stores({
      settings: 'id',
      currencies: 'code, active',
      accounts: 'id, isActive, archivedAt, sortOrder, currencyCode',
      categories:
        'id, kind, isActive, isFavorite, archivedAt, parentCategoryId',
      funds: 'id, isActive, isDefault, archivedAt',
      treatments: 'id, behaviorKey, isSystem, isActive',
      transactions:
        'id, date, accountId, categoryId, fundId, treatmentId, transactionType, linkedTransferId, deletedAt, normalizedTitle, [date+transactionType]',
      budgetPlans: 'id, effectiveFrom, effectiveTo, isActive',
      budgetAllocations: 'id, budgetPlanId, categoryId',
      periodReports: 'id, periodStart, periodEnd, closedAt',
      titleSuggestions: 'normalizedTitle, lastUsedAt, useCount',
    })
  }
}

export const db = new MyFinanceDatabase()
