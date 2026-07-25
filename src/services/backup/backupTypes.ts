import { z } from 'zod'
import {
  accountSchema,
  budgetAllocationSchema,
  budgetPlanSchema,
  categorySchema,
  currencySchema,
  fundSchema,
  periodReportSchema,
  titleSuggestionSchema,
  transactionSchema,
  treatmentSchema,
  userSettingsSchema,
} from '@/domain/schemas'

export const BACKUP_TABLE_KEYS = [
  'settings',
  'currencies',
  'accounts',
  'categories',
  'funds',
  'treatments',
  'transactions',
  'budgetPlans',
  'budgetAllocations',
  'periodReports',
  'titleSuggestions',
] as const

export type BackupTableKey = (typeof BACKUP_TABLE_KEYS)[number]

export const backupPayloadSchema = z.object({
  settings: z.array(userSettingsSchema),
  currencies: z.array(currencySchema),
  accounts: z.array(accountSchema),
  categories: z.array(categorySchema),
  funds: z.array(fundSchema),
  treatments: z.array(treatmentSchema),
  transactions: z.array(transactionSchema),
  budgetPlans: z.array(budgetPlanSchema),
  budgetAllocations: z.array(budgetAllocationSchema),
  periodReports: z.array(periodReportSchema),
  titleSuggestions: z.array(titleSuggestionSchema),
})

export type BackupPayload = z.infer<typeof backupPayloadSchema>

export type BackupImportMode = 'merge' | 'replace'

export interface BackupPreview {
  appName: string
  schemaVersion: number
  exportedAt: string
  codec: 'plain'
  counts: Record<BackupTableKey, number>
  warnings: string[]
}

export interface BackupParseSuccess {
  ok: true
  envelope: import('@/domain/types').BackupEnvelope
  payload: BackupPayload
  preview: BackupPreview
}

export interface BackupParseFailure {
  ok: false
  error: string
  warnings: string[]
}
