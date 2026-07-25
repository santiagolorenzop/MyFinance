export const ACCOUNT_TYPES = [
  'cash',
  'checking',
  'savings',
  'debit',
  'credit_card',
  'digital_wallet',
  'loan',
  'other',
] as const

export type AccountType = (typeof ACCOUNT_TYPES)[number]

export const CATEGORY_KINDS = ['expense', 'income', 'both'] as const
export type CategoryKind = (typeof CATEGORY_KINDS)[number]

export const TRANSACTION_TYPES = [
  'expense',
  'income',
  'transfer',
  'adjustment',
] as const
export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export const ENTRY_SOURCES = [
  'manual',
  'voice',
  'import',
  'recurring',
  'adjustment',
] as const
export type EntrySource = (typeof ENTRY_SOURCES)[number]

/** Stable system behavior keys — never rename for logic. */
export const TREATMENT_BEHAVIOR_KEYS = [
  'monthly_budget',
  'excluded',
  'first_month_extra',
  'internal_transfer',
] as const
export type TreatmentBehaviorKey = (typeof TREATMENT_BEHAVIOR_KEYS)[number]

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export const BACKUP_CODECS = ['plain'] as const
export type BackupCodecKind = (typeof BACKUP_CODECS)[number]
