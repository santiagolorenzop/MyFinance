import {
  applySuccessfulExpenseSave,
  canUndo,
  createExpenseTransaction,
  createUndoSession,
  undoExpense,
  type ExpenseDraft,
  type UndoSession,
} from '@/services/transaction'

export type { UndoSession }
import { db } from '@/db'
import {
  getTransaction,
  saveTransaction,
  softDeleteTransactionById,
} from '@/repositories/transactionsRepository'
import {
  listSuggestions,
  syncSuggestionRow,
} from '@/repositories/suggestionsRepository'
import type { Transaction } from '@/domain/types'

export type SaveExpenseFlowResult =
  | { ok: true; transaction: Transaction; session: UndoSession; clearDraft: true }
  | { ok: false; error: string; preserveDraft: true }

/**
 * Build expense via Phase 2 engine, then persist transaction + suggestion memory.
 */
export async function saveExpenseFlow(draft: ExpenseDraft): Promise<SaveExpenseFlowResult> {
  const created = createExpenseTransaction(draft)
  if (!created.ok) {
    return created
  }

  const savedAtMs = Date.now()
  const memoryBefore = await listSuggestions()
  const applied = applySuccessfulExpenseSave({
    ledger: [],
    memory: memoryBefore,
    transaction: created.transaction,
    savedAtMs,
  })

  try {
    await db.transaction('rw', db.transactions, db.titleSuggestions, async () => {
      await saveTransaction(created.transaction)
      await syncSuggestionRow(
        memoryBefore,
        applied.memory,
        created.transaction.normalizedTitle,
      )
    })
  } catch {
    return {
      ok: false,
      error: 'Could not save expense. Your draft was kept.',
      preserveDraft: true,
    }
  }

  return {
    ok: true,
    transaction: created.transaction,
    session: applied.session,
    clearDraft: true,
  }
}

export type UndoExpenseFlowResult =
  | { ok: true }
  | { ok: false; reason: 'no_session' | 'expired' | 'not_found' | 'persist_failed' }

/**
 * Undo latest expense using Phase 2 rules, then persist soft-delete + suggestion reversal.
 */
export async function undoExpenseFlow(input: {
  session: UndoSession | null
  nowMs?: number
}): Promise<UndoExpenseFlowResult> {
  const nowMs = input.nowMs ?? Date.now()
  const session = input.session
  if (!session || !canUndo(session, nowMs)) {
    return { ok: false, reason: session ? 'expired' : 'no_session' }
  }

  const existing = await getTransaction(session.transactionId)
  if (!existing || existing.deletedAt != null) {
    return { ok: false, reason: 'not_found' }
  }

  const memoryBefore = await listSuggestions()
  const result = undoExpense({
    session,
    nowMs,
    ledger: [existing],
    memory: memoryBefore,
  })

  if (!result.ok) {
    return { ok: false, reason: result.reason }
  }

  try {
    await db.transaction('rw', db.transactions, db.titleSuggestions, async () => {
      await softDeleteTransactionById(existing.id, new Date(nowMs).toISOString())
      await syncSuggestionRow(memoryBefore, result.memory, existing.normalizedTitle)
    })
  } catch {
    return { ok: false, reason: 'persist_failed' }
  }

  return { ok: true }
}

export { createUndoSession }
