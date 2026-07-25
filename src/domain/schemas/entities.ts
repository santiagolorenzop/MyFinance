import { z } from 'zod'
import {
  ACCOUNT_TYPES,
  CATEGORY_KINDS,
  ENTRY_SOURCES,
  THEME_PREFERENCES,
  TRANSACTION_TYPES,
  TREATMENT_BEHAVIOR_KEYS,
} from '@/domain/enums'
import {
  financialDateSchema,
  idSchema,
  moneyMinorSchema,
} from '@/domain/schemas/common'

export const currencySchema = z.object({
  code: z.string().min(1).max(16),
  displayName: z.string().min(1),
  symbol: z.string().min(1),
  decimalPlaces: z.number().int().min(0).max(6),
  active: z.boolean(),
})

export const userSettingsSchema = z.object({
  id: z.string().min(1),
  preferredLanguage: z.string().min(2),
  baseCurrency: z.string().min(1),
  locale: z.string().min(2),
  financialPeriodStartDay: z.number().int().min(1).max(31),
  firstDayOfWeek: z.number().int().min(0).max(6),
  defaultAccountId: idSchema.nullable(),
  defaultFundId: idSchema.nullable(),
  defaultTreatmentId: idSchema.nullable(),
  requireConfirmationBeforeSaving: z.boolean(),
  enableVoiceInput: z.boolean(),
  enableSmartSuggestions: z.boolean(),
  showAdvancedTransactionFields: z.boolean(),
  themePreference: z.enum(THEME_PREFERENCES),
  onboardingCompleted: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  schemaVersion: z.number().int().positive(),
})

export const accountSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  type: z.enum(ACCOUNT_TYPES),
  currencyCode: z.string().min(1),
  initialBalanceMinor: moneyMinorSchema,
  initialBalanceDate: financialDateSchema,
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  includeInTotalNetBalance: z.boolean(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
})

export const categorySchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  kind: z.enum(CATEGORY_KINDS),
  parentCategoryId: idSchema.nullable(),
  icon: z.string().nullable(),
  sortOrder: z.number().int(),
  isFavorite: z.boolean(),
  isActive: z.boolean(),
  colorToken: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
})

export const fundSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  description: z.string().nullable(),
  targetAmountMinor: moneyMinorSchema.nullable(),
  currencyCode: z.string().nullable(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archivedAt: z.string().nullable(),
})

export const treatmentSchema = z.object({
  id: idSchema,
  behaviorKey: z.enum(TREATMENT_BEHAVIOR_KEYS),
  displayName: z.string().min(1),
  description: z.string().nullable(),
  countsTowardMonthlyBudget: z.boolean(),
  countsAsAccountMovement: z.boolean(),
  isTransferBehavior: z.boolean(),
  isSystem: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const transactionSchema = z.object({
  id: idSchema,
  date: financialDateSchema,
  title: z.string(),
  normalizedTitle: z.string(),
  notes: z.string().nullable(),
  transactionType: z.enum(TRANSACTION_TYPES),
  accountId: idSchema,
  categoryId: idSchema.nullable(),
  fundId: idSchema.nullable(),
  treatmentId: idSchema,
  originalAmountMinor: moneyMinorSchema,
  originalCurrencyCode: z.string().min(1),
  accountAmountMinor: moneyMinorSchema,
  accountCurrencyCode: z.string().min(1),
  baseCurrencyAmountMinor: moneyMinorSchema.nullable(),
  exchangeRate: z.string().nullable(),
  exchangeRateSource: z.string().nullable(),
  destinationAccountId: idSchema.nullable(),
  linkedTransferId: idSchema.nullable(),
  linkedTransactionId: idSchema.nullable(),
  entrySource: z.enum(ENTRY_SOURCES),
  createdAt: z.string(),
  updatedAt: z.string(),
  deletedAt: z.string().nullable(),
})

export const budgetPlanSchema = z.object({
  id: idSchema,
  name: z.string().min(1),
  baseCurrencyCode: z.string().min(1),
  effectiveFrom: financialDateSchema,
  effectiveTo: financialDateSchema.nullable(),
  financialPeriodStartDay: z.number().int().min(1).max(31).nullable(),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const budgetAllocationSchema = z.object({
  id: idSchema,
  budgetPlanId: idSchema,
  categoryId: idSchema,
  allocatedAmountMinor: moneyMinorSchema,
  sortOrder: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const categorySnapshotSchema = z.object({
  categoryId: idSchema,
  categoryDisplayName: z.string(),
  allocatedAmountMinor: moneyMinorSchema,
  spentAmountMinor: moneyMinorSchema,
  remainingAmountMinor: moneyMinorSchema,
  percentageUsed: z.number().nullable(),
})

export const periodReportSchema = z.object({
  id: idSchema,
  periodStart: financialDateSchema,
  periodEnd: financialDateSchema,
  budgetPlanId: idSchema.nullable(),
  baseCurrencyCode: z.string().min(1),
  totalBudgetMinor: moneyMinorSchema,
  totalSpentMinor: moneyMinorSchema,
  remainingMinor: moneyMinorSchema,
  closedAt: z.string().nullable(),
  snapshotData: z.array(categorySnapshotSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const titleSuggestionSchema = z.object({
  normalizedTitle: z.string().min(1),
  originalRecentTitles: z.array(z.string()),
  mostUsedCategoryId: idSchema.nullable(),
  mostUsedAccountId: idSchema.nullable(),
  mostUsedFundId: idSchema.nullable(),
  mostUsedTreatmentId: idSchema.nullable(),
  useCount: z.number().int().nonnegative(),
  lastUsedAt: z.string(),
})

export const backupEnvelopeSchema = z.object({
  format: z.literal('myfinance-backup'),
  schemaVersion: z.number().int().positive(),
  appName: z.string().min(1),
  exportedAt: z.string(),
  codec: z.literal('plain'),
  payload: z.record(z.string(), z.unknown()),
})
