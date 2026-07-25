import {
  applySuccessfulIncomeSave,
  createIncomeTransaction,
  type MoneyEntryDraft,
  type UndoSession,
} from '@/services/transaction'
import { db } from '@/db'
import { saveTransaction } from '@/repositories/transactionsRepository'
import {
  listSuggestions,
  syncSuggestionRow,
} from '@/repositories/suggestionsRepository'
import type { Transaction } from '@/domain/types'

export type SaveIncomeFlowResult =
  | { ok: true; transaction: Transaction; session: UndoSession; clearDraft: true }
  | { ok: false; error: string; preserveDraft: true }

/**
 * Build income via shared money-entry engine, then persist + suggestion memory.
 */
export async function saveIncomeFlow(draft: MoneyEntryDraft): Promise<SaveIncomeFlowResult> {
  const created = createIncomeTransaction(draft)
  if (!created.ok) {
    return created
  }

  const savedAtMs = Date.now()
  const memoryBefore = await listSuggestions()
  const applied = applySuccessfulIncomeSave({
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
      error: 'Could not save income. Your draft was kept.',
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
