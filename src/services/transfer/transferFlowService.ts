import {
  createTransferLegs,
  editTransferInLedger,
  softDeleteTransferInLedger,
  type TransferDraft,
  type TransferLegs,
} from '@/services/transfer/transferService'
import { db } from '@/db'
import {
  listTransactionsByTransferId,
  saveTransactions,
} from '@/repositories/transactionsRepository'
import type { Transaction } from '@/domain/types'

export type SaveTransferFlowResult =
  | { ok: true; legs: TransferLegs; clearDraft: true }
  | { ok: false; error: string; preserveDraft: true }

export async function saveTransferFlow(
  draft: TransferDraft,
): Promise<SaveTransferFlowResult> {
  let legs: TransferLegs
  try {
    legs = createTransferLegs(draft)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not create transfer',
      preserveDraft: true,
    }
  }

  try {
    await db.transaction('rw', db.transactions, async () => {
      await saveTransactions([legs.outgoing, legs.incoming])
    })
  } catch {
    return {
      ok: false,
      error: 'Could not save transfer. Your draft was kept.',
      preserveDraft: true,
    }
  }

  return { ok: true, legs, clearDraft: true }
}

export async function updateTransferFlow(
  draft: TransferDraft,
): Promise<SaveTransferFlowResult> {
  const existing = await listTransactionsByTransferId(draft.transferId, true)
  let nextLedger: Transaction[]
  try {
    nextLedger = editTransferInLedger(existing, draft)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not update transfer',
      preserveDraft: true,
    }
  }

  const legs = {
    transferId: draft.transferId,
    outgoing: nextLedger.find(
      (tx) =>
        tx.linkedTransferId === draft.transferId && tx.destinationAccountId != null,
    )!,
    incoming: nextLedger.find(
      (tx) =>
        tx.linkedTransferId === draft.transferId && tx.destinationAccountId == null,
    )!,
  }

  if (!legs.outgoing || !legs.incoming) {
    return {
      ok: false,
      error: 'Transfer legs are incomplete.',
      preserveDraft: true,
    }
  }

  try {
    await db.transaction('rw', db.transactions, async () => {
      await saveTransactions([legs.outgoing, legs.incoming])
    })
  } catch {
    return {
      ok: false,
      error: 'Could not save transfer. Your draft was kept.',
      preserveDraft: true,
    }
  }

  return { ok: true, legs, clearDraft: true }
}

export type DeleteTransferFlowResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'persist_failed' }

export async function deleteTransferFlow(transferId: string): Promise<DeleteTransferFlowResult> {
  const existing = await listTransactionsByTransferId(transferId, false)
  if (existing.length === 0) {
    return { ok: false, reason: 'not_found' }
  }

  const deletedAt = new Date().toISOString()
  const next = softDeleteTransferInLedger(existing, transferId, deletedAt)

  try {
    await db.transaction('rw', db.transactions, async () => {
      await saveTransactions(next)
    })
  } catch {
    return { ok: false, reason: 'persist_failed' }
  }

  return { ok: true }
}
