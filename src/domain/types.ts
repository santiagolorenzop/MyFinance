import type { z } from 'zod'
import type {
  accountSchema,
  backupEnvelopeSchema,
  budgetAllocationSchema,
  budgetPlanSchema,
  categorySchema,
  categorySnapshotSchema,
  currencySchema,
  exchangeRateSchema,
  fundSchema,
  periodReportSchema,
  titleSuggestionSchema,
  transactionSchema,
  treatmentSchema,
  userSettingsSchema,
} from '@/domain/schemas/entities'
import type { moneyAmountSchema } from '@/domain/schemas/common'

export type MoneyAmount = z.infer<typeof moneyAmountSchema>
export type FinancialDate = string

export type Currency = z.infer<typeof currencySchema>
export type ExchangeRate = z.infer<typeof exchangeRateSchema>
export type UserSettings = z.infer<typeof userSettingsSchema>

/** Reporting currency for budgets/stats/reports (falls back to baseCurrency). */
export function getReportingCurrency(
  settings: Pick<UserSettings, 'baseCurrency' | 'reportingCurrency'>,
): string {
  return settings.reportingCurrency ?? settings.baseCurrency
}
export type Account = z.infer<typeof accountSchema>
export type Category = z.infer<typeof categorySchema>
export type Fund = z.infer<typeof fundSchema>
export type Treatment = z.infer<typeof treatmentSchema>
export type Transaction = z.infer<typeof transactionSchema>
export type BudgetPlan = z.infer<typeof budgetPlanSchema>
export type BudgetAllocation = z.infer<typeof budgetAllocationSchema>
export type CategorySnapshot = z.infer<typeof categorySnapshotSchema>
export type PeriodReport = z.infer<typeof periodReportSchema>
export type TitleSuggestion = z.infer<typeof titleSuggestionSchema>
export type BackupEnvelope = z.infer<typeof backupEnvelopeSchema>

export type SearchMatchedField =
  | 'title'
  | 'normalizedTitle'
  | 'notes'
  | 'category'
  | 'account'
  | 'fund'
  | 'treatment'
  | 'currency'
  | 'date'
  | 'period'

export interface SearchMatch {
  transactionId: string
  matchedFields: SearchMatchedField[]
}
