import {
  createExpenseTransaction,
  createIncomeTransaction,
  draftFromTransactionForDuplicate,
  rebuildMoneyEntryTransaction,
  softDeleteTransaction,
  type MoneyEntryDraft,
} from '@/services/transaction'
import { softDeleteTransferInLedger } from '@/services/transfer'
import { deleteTransferFlow } from '@/services/transfer/transferFlowService'
import { db } from '@/db'
import { getSettings } from '@/repositories/settingsRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import {
  getTransaction,
  listTransactionsByTransferId,
  saveTransaction,
} from '@/repositories/transactionsRepository'
import {
  listSuggestions,
  syncSuggestionRow,
} from '@/repositories/suggestionsRepository'
import { recordSuggestionUsage, reverseSuggestionUsage } from '@/services/suggestion'
import type { Transaction } from '@/domain/types'
import { todayFinancialDate } from '@/utils/dates'

export type UpdateMoneyEntryFlowResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; error: string }

export async function updateMoneyEntryFlow(
  existingId: string,
  draft: MoneyEntryDraft,
): Promise<UpdateMoneyEntryFlowResult> {
  const existing = await getTransaction(existingId)
  if (!existing || existing.deletedAt != null) {
    return { ok: false, error: 'Transaction not found.' }
  }
  if (existing.transactionType !== 'expense' && existing.transactionType !== 'income') {
    return { ok: false, error: 'This transaction type cannot be edited here.' }
  }

  const rebuilt = rebuildMoneyEntryTransaction(existing, draft)
  if (!rebuilt.ok) {
    return { ok: false, error: rebuilt.error }
  }

  const memoryBefore = await listSuggestions()
  const reversed = reverseSuggestionUsage(
    memoryBefore,
    existing.normalizedTitle,
    existing.title,
  )
  const memoryAfter = recordSuggestionUsage(
    reversed,
    rebuilt.transaction,
    rebuilt.transaction.updatedAt,
  )

  try {
    await db.transaction('rw', db.transactions, db.titleSuggestions, async () => {
      await saveTransaction(rebuilt.transaction)
      await syncSuggestionRow(memoryBefore, reversed, existing.normalizedTitle)
      await syncSuggestionRow(reversed, memoryAfter, rebuilt.transaction.normalizedTitle)
    })
  } catch {
    return { ok: false, error: 'Could not update transaction.' }
  }

  return { ok: true, transaction: rebuilt.transaction }
}

export type DeleteMovementFlowResult =
  | { ok: true; kind: 'transaction' | 'transfer' }
  | { ok: false; reason: 'not_found' | 'persist_failed' }

/**
 * Soft-delete a movement. Transfers delete both legs via transfer engine helpers.
 */
export async function deleteMovementFlow(transactionId: string): Promise<DeleteMovementFlowResult> {
  const existing = await getTransaction(transactionId)
  if (!existing || existing.deletedAt != null) {
    return { ok: false, reason: 'not_found' }
  }

  if (existing.transactionType === 'transfer' && existing.linkedTransferId) {
    const result = await deleteTransferFlow(existing.linkedTransferId)
    if (!result.ok) return { ok: false, reason: result.reason }
    return { ok: true, kind: 'transfer' }
  }

  const deletedAt = new Date().toISOString()
  const memoryBefore = await listSuggestions()
  const nextLedger = softDeleteTransaction([existing], existing.id, deletedAt)
  const deleted = nextLedger[0]!
  const memoryAfter = reverseSuggestionUsage(
    memoryBefore,
    existing.normalizedTitle,
    existing.title,
  )

  try {
    await db.transaction('rw', db.transactions, db.titleSuggestions, async () => {
      await saveTransaction(deleted)
      await syncSuggestionRow(memoryBefore, memoryAfter, existing.normalizedTitle)
    })
  } catch {
    return { ok: false, reason: 'persist_failed' }
  }

  return { ok: true, kind: 'transaction' }
}

export type DuplicateMovementFlowResult =
  | { ok: true; transaction: Transaction }
  | { ok: false; error: string }

/**
 * Duplicate expense/income as a new ledger row (today's date).
 * Transfers are not duplicated in Phase 5.
 */
export async function duplicateMoneyEntryFlow(
  transactionId: string,
): Promise<DuplicateMovementFlowResult> {
  const existing = await getTransaction(transactionId)
  if (!existing || existing.deletedAt != null) {
    return { ok: false, error: 'Transaction not found.' }
  }

  const now = new Date().toISOString()
  const partial = draftFromTransactionForDuplicate(existing, now, todayFinancialDate())
  if (!partial) {
    return { ok: false, error: 'Only expense and income can be duplicated.' }
  }

  const currencies = await listCurrencies()
  const settings = await getSettings()
  const currencyMap: MoneyEntryDraft['currencies'] = {}
  for (const currency of currencies) {
    currencyMap[currency.code] = {
      code: currency.code,
      decimalPlaces: currency.decimalPlaces,
    }
  }

  const draft: MoneyEntryDraft = {
    ...partial,
    accountCurrencyCode: existing.accountCurrencyCode,
    baseCurrencyCode: settings?.baseCurrency ?? existing.accountCurrencyCode,
    currencies: currencyMap,
  }

  const created =
    existing.transactionType === 'income'
      ? createIncomeTransaction(draft)
      : createExpenseTransaction(draft)

  if (!created.ok) {
    return { ok: false, error: created.error }
  }

  const memoryBefore = await listSuggestions()
  const memoryAfter = recordSuggestionUsage(
    memoryBefore,
    created.transaction,
    created.transaction.createdAt,
  )

  try {
    await db.transaction('rw', db.transactions, db.titleSuggestions, async () => {
      await saveTransaction(created.transaction)
      await syncSuggestionRow(
        memoryBefore,
        memoryAfter,
        created.transaction.normalizedTitle,
      )
    })
  } catch {
    return { ok: false, error: 'Could not duplicate transaction.' }
  }

  return { ok: true, transaction: created.transaction }
}

/** Soft-delete helper for tests that already have both legs in memory. */
export function softDeleteTransferLegsInMemory(
  legs: Transaction[],
  transferId: string,
  deletedAt: string,
): Transaction[] {
  return softDeleteTransferInLedger(legs, transferId, deletedAt)
}

export async function loadTransferCompanion(
  tx: Transaction,
): Promise<Transaction | null> {
  if (!tx.linkedTransferId) return null
  const legs = await listTransactionsByTransferId(tx.linkedTransferId)
  return legs.find((row) => row.id !== tx.id) ?? null
}
