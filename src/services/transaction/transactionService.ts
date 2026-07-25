import { UNDO_TIMEOUT_MS } from '@/config/app'
import { resolveConversion } from '@/services/currency'
import { normalizeTitle, recordSuggestionUsage, reverseSuggestionUsage } from '@/services/suggestion'
import type { Currency, TitleSuggestion, Transaction } from '@/domain/types'
import type { FinancialDate } from '@/utils/dates'

/** Shared draft for expense and income money entries. */
export interface MoneyEntryDraft {
  id?: string
  date: FinancialDate
  title: string
  notes?: string | null
  accountId: string
  categoryId?: string | null
  fundId?: string | null
  treatmentId: string
  originalAmountMinor: number
  originalCurrencyCode: string
  accountCurrencyCode: string
  baseCurrencyCode: string
  accountAmountMinor?: number | null
  exchangeRate?: string | null
  baseCurrencyAmountMinor?: number | null
  currencies: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>>
  entrySource?: Transaction['entrySource']
  createdAt: string
  updatedAt: string
}

/** @deprecated Prefer MoneyEntryDraft — kept as alias for Phase 4 callers. */
export type ExpenseDraft = MoneyEntryDraft

export interface CreateMoneyEntryResult {
  transaction: Transaction
  ok: true
}

export interface CreateMoneyEntryFailure {
  ok: false
  error: string
  /** Draft is preserved by the caller — engine does not clear it. */
  preserveDraft: true
}

export type CreateExpenseResult = CreateMoneyEntryResult
export type CreateExpenseFailure = CreateMoneyEntryFailure

function createMoneyEntryTransaction(
  draft: MoneyEntryDraft,
  transactionType: 'expense' | 'income',
): CreateMoneyEntryResult | CreateMoneyEntryFailure {
  const title = draft.title.trim()
  if (!title) {
    return { ok: false, error: 'Title is required', preserveDraft: true }
  }
  if (!Number.isFinite(draft.originalAmountMinor) || draft.originalAmountMinor <= 0) {
    return { ok: false, error: 'Enter a valid amount.', preserveDraft: true }
  }
  if (!draft.accountId) {
    return { ok: false, error: 'Select an account.', preserveDraft: true }
  }

  try {
    const conversion = resolveConversion({
      originalAmountMinor: draft.originalAmountMinor,
      originalCurrencyCode: draft.originalCurrencyCode,
      accountCurrencyCode: draft.accountCurrencyCode,
      baseCurrencyCode: draft.baseCurrencyCode,
      accountAmountMinor: draft.accountAmountMinor,
      exchangeRate: draft.exchangeRate,
      baseCurrencyAmountMinor: draft.baseCurrencyAmountMinor,
      currencies: draft.currencies,
    })

    if (conversion.status === 'missing_account_amount') {
      return {
        ok: false,
        error: 'This account uses a different currency. Enter the amount charged to the account.',
        preserveDraft: true,
      }
    }

    const transaction: Transaction = {
      id: draft.id ?? crypto.randomUUID(),
      date: draft.date,
      title,
      normalizedTitle: normalizeTitle(title),
      notes: draft.notes ?? null,
      transactionType,
      accountId: draft.accountId,
      categoryId: draft.categoryId ?? null,
      fundId: draft.fundId ?? null,
      treatmentId: draft.treatmentId,
      originalAmountMinor: draft.originalAmountMinor,
      originalCurrencyCode: draft.originalCurrencyCode,
      accountAmountMinor: conversion.accountAmountMinor,
      accountCurrencyCode: conversion.accountCurrencyCode,
      baseCurrencyAmountMinor: conversion.baseCurrencyAmountMinor,
      exchangeRate: conversion.exchangeRate,
      exchangeRateSource: conversion.exchangeRate ? 'manual' : null,
      destinationAccountId: null,
      linkedTransferId: null,
      linkedTransactionId: null,
      entrySource: draft.entrySource ?? 'manual',
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      deletedAt: null,
    }

    return { ok: true, transaction }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not save transaction',
      preserveDraft: true,
    }
  }
}

export function createExpenseTransaction(
  draft: MoneyEntryDraft,
): CreateMoneyEntryResult | CreateMoneyEntryFailure {
  return createMoneyEntryTransaction(draft, 'expense')
}

export function createIncomeTransaction(
  draft: MoneyEntryDraft,
): CreateMoneyEntryResult | CreateMoneyEntryFailure {
  return createMoneyEntryTransaction(draft, 'income')
}

/**
 * Rebuild an expense/income row from a draft while preserving id and createdAt.
 * Reuses the same conversion rules as create.
 */
export function rebuildMoneyEntryTransaction(
  existing: Transaction,
  draft: MoneyEntryDraft,
): CreateMoneyEntryResult | CreateMoneyEntryFailure {
  if (existing.transactionType !== 'expense' && existing.transactionType !== 'income') {
    return {
      ok: false,
      error: 'Only expense and income entries can be rebuilt this way.',
      preserveDraft: true,
    }
  }
  const result = createMoneyEntryTransaction(
    {
      ...draft,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: draft.updatedAt,
    },
    existing.transactionType,
  )
  return result
}

/** Build a new-entry draft clone for duplicate (new id assigned on create). */
export function draftFromTransactionForDuplicate(
  tx: Transaction,
  nowIso: string,
  date: FinancialDate,
): Omit<MoneyEntryDraft, 'currencies' | 'baseCurrencyCode' | 'accountCurrencyCode'> | null {
  if (tx.transactionType !== 'expense' && tx.transactionType !== 'income') {
    return null
  }
  return {
    date,
    title: tx.title,
    notes: tx.notes,
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    fundId: tx.fundId,
    treatmentId: tx.treatmentId,
    originalAmountMinor: tx.originalAmountMinor,
    originalCurrencyCode: tx.originalCurrencyCode,
    accountAmountMinor:
      tx.originalCurrencyCode === tx.accountCurrencyCode ? null : tx.accountAmountMinor,
    exchangeRate: tx.exchangeRate,
    baseCurrencyAmountMinor: tx.baseCurrencyAmountMinor,
    entrySource: 'manual',
    createdAt: nowIso,
    updatedAt: nowIso,
  }
}

export function softDeleteTransaction(
  ledger: Transaction[],
  transactionId: string,
  deletedAt: string,
): Transaction[] {
  return ledger.map((tx) =>
    tx.id === transactionId ? { ...tx, deletedAt, updatedAt: deletedAt } : tx,
  )
}

export interface UndoSession {
  transactionId: string
  savedAtMs: number
  timeoutMs: number
}

export type UndoResult =
  | {
      ok: true
      ledger: Transaction[]
      memory: TitleSuggestion[]
      session: null
    }
  | { ok: false; reason: 'no_session' | 'expired' | 'not_found' }

/**
 * Only the most recently saved expense/income is undoable.
 * Saving another entry replaces the session after the previous one is finalized.
 */
export function createUndoSession(
  transactionId: string,
  savedAtMs: number,
  timeoutMs = UNDO_TIMEOUT_MS,
): UndoSession {
  return { transactionId, savedAtMs, timeoutMs }
}

export function canUndo(session: UndoSession | null, nowMs: number): boolean {
  if (!session) return false
  return nowMs - session.savedAtMs <= session.timeoutMs
}

export function undoExpense(input: {
  session: UndoSession | null
  nowMs: number
  ledger: Transaction[]
  memory: TitleSuggestion[]
}): UndoResult {
  const { session, nowMs, ledger, memory } = input
  if (!session) return { ok: false, reason: 'no_session' }
  if (!canUndo(session, nowMs)) return { ok: false, reason: 'expired' }

  const tx = ledger.find((row) => row.id === session.transactionId && row.deletedAt == null)
  if (!tx) return { ok: false, reason: 'not_found' }

  const deletedAt = new Date(nowMs).toISOString()
  const nextLedger = softDeleteTransaction(ledger, tx.id, deletedAt)
  const nextMemory = reverseSuggestionUsage(memory, tx.normalizedTitle, tx.title)

  return {
    ok: true,
    ledger: nextLedger,
    memory: nextMemory,
    session: null,
  }
}

/** Alias — same soft-delete + suggestion reverse path for income. */
export const undoIncome = undoExpense

export function applySuccessfulExpenseSave(input: {
  ledger: Transaction[]
  memory: TitleSuggestion[]
  transaction: Transaction
  savedAtMs: number
}): {
  ledger: Transaction[]
  memory: TitleSuggestion[]
  session: UndoSession
  clearDraft: true
} {
  const ledger = [...input.ledger, input.transaction]
  const memory = recordSuggestionUsage(
    input.memory,
    input.transaction,
    input.transaction.createdAt,
  )
  return {
    ledger,
    memory,
    session: createUndoSession(input.transaction.id, input.savedAtMs),
    clearDraft: true,
  }
}

/** Alias — same memory update path for income. */
export const applySuccessfulIncomeSave = applySuccessfulExpenseSave

/** When a second save happens, previous undo opportunity is dropped. */
export function replaceUndoSessionOnNewSave(
  _previous: UndoSession | null,
  nextTransactionId: string,
  savedAtMs: number,
): UndoSession {
  return createUndoSession(nextTransactionId, savedAtMs)
}
