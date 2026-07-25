import { normalizeTitle } from '@/services/suggestion'
import type { Transaction } from '@/domain/types'
import type { FinancialDate } from '@/utils/dates'

export interface TransferDraft {
  transferId: string
  date: FinancialDate
  title: string
  notes?: string | null
  sourceAccountId: string
  destinationAccountId: string
  sourceAmountMinor: number
  sourceCurrencyCode: string
  destinationAmountMinor: number
  destinationCurrencyCode: string
  exchangeRate?: string | null
  exchangeRateDate?: string | null
  exchangeRateSource?: string | null
  treatmentId: string
  entrySource?: Transaction['entrySource']
  createdAt: string
  updatedAt: string
}

export interface TransferLegs {
  transferId: string
  outgoing: Transaction
  incoming: Transaction
}

/**
 * Build both ledger legs for a transfer. Caller persists atomically.
 */
export function createTransferLegs(draft: TransferDraft): TransferLegs {
  if (draft.sourceAccountId === draft.destinationAccountId) {
    throw new Error('Source and destination accounts must differ')
  }
  if (draft.sourceAmountMinor <= 0 || draft.destinationAmountMinor <= 0) {
    throw new Error('Transfer amounts must be positive')
  }

  const title = draft.title.trim() || 'Transfer'
  const outgoingId = crypto.randomUUID()
  const incomingId = crypto.randomUUID()

  const outgoing: Transaction = {
    id: outgoingId,
    date: draft.date,
    title,
    normalizedTitle: normalizeTitle(title),
    notes: draft.notes ?? null,
    transactionType: 'transfer',
    accountId: draft.sourceAccountId,
    categoryId: null,
    fundId: null,
    treatmentId: draft.treatmentId,
    originalAmountMinor: draft.sourceAmountMinor,
    originalCurrencyCode: draft.sourceCurrencyCode,
    accountAmountMinor: draft.sourceAmountMinor,
    accountCurrencyCode: draft.sourceCurrencyCode,
    baseCurrencyAmountMinor: null,
    exchangeRate: draft.exchangeRate ?? null,
    exchangeRateSource: draft.exchangeRate
      ? (draft.exchangeRateSource ?? 'manual')
      : null,
    exchangeRateDate: draft.exchangeRateDate ?? null,
    destinationAccountId: draft.destinationAccountId,
    linkedTransferId: draft.transferId,
    linkedTransactionId: incomingId,
    entrySource: draft.entrySource ?? 'manual',
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    deletedAt: null,
  }

  const incoming: Transaction = {
    id: incomingId,
    date: draft.date,
    title,
    normalizedTitle: normalizeTitle(title),
    notes: draft.notes ?? null,
    transactionType: 'transfer',
    accountId: draft.destinationAccountId,
    categoryId: null,
    fundId: null,
    treatmentId: draft.treatmentId,
    originalAmountMinor: draft.destinationAmountMinor,
    originalCurrencyCode: draft.destinationCurrencyCode,
    accountAmountMinor: draft.destinationAmountMinor,
    accountCurrencyCode: draft.destinationCurrencyCode,
    baseCurrencyAmountMinor: null,
    exchangeRate: draft.exchangeRate ?? null,
    exchangeRateSource: draft.exchangeRate
      ? (draft.exchangeRateSource ?? 'manual')
      : null,
    exchangeRateDate: draft.exchangeRateDate ?? null,
    destinationAccountId: null,
    linkedTransferId: draft.transferId,
    linkedTransactionId: outgoingId,
    entrySource: draft.entrySource ?? 'manual',
    createdAt: draft.createdAt,
    updatedAt: draft.updatedAt,
    deletedAt: null,
  }

  return { transferId: draft.transferId, outgoing, incoming }
}

/** Replace both legs in a ledger array. */
export function upsertTransferInLedger(
  ledger: Transaction[],
  legs: TransferLegs,
): Transaction[] {
  const without = ledger.filter((tx) => tx.linkedTransferId !== legs.transferId)
  return [...without, legs.outgoing, legs.incoming]
}

/** Soft-delete both legs of a transfer. */
export function softDeleteTransferInLedger(
  ledger: Transaction[],
  transferId: string,
  deletedAt: string,
): Transaction[] {
  return ledger.map((tx) =>
    tx.linkedTransferId === transferId
      ? { ...tx, deletedAt, updatedAt: deletedAt }
      : tx,
  )
}

/** Hard-remove both legs (for tests / compact ledgers). */
export function removeTransferFromLedger(
  ledger: Transaction[],
  transferId: string,
): Transaction[] {
  return ledger.filter((tx) => tx.linkedTransferId !== transferId)
}

export function getTransferLegsFromLedger(
  ledger: Transaction[],
  transferId: string,
): TransferLegs | null {
  const legs = ledger.filter(
    (tx) => tx.linkedTransferId === transferId && tx.deletedAt == null,
  )
  const outgoing = legs.find((tx) => tx.destinationAccountId != null)
  const incoming = legs.find((tx) => tx.destinationAccountId == null)
  if (!outgoing || !incoming) return null
  return { transferId, outgoing, incoming }
}

export function editTransferInLedger(
  ledger: Transaction[],
  draft: TransferDraft,
): Transaction[] {
  const existing = getTransferLegsFromLedger(ledger, draft.transferId)
  const legs = createTransferLegs(draft)
  // Preserve leg ids when editing so references stay stable.
  if (existing) {
    legs.outgoing = {
      ...legs.outgoing,
      id: existing.outgoing.id,
      linkedTransactionId: existing.incoming.id,
      createdAt: existing.outgoing.createdAt,
    }
    legs.incoming = {
      ...legs.incoming,
      id: existing.incoming.id,
      linkedTransactionId: existing.outgoing.id,
      createdAt: existing.incoming.createdAt,
    }
  }
  return upsertTransferInLedger(ledger, legs)
}
