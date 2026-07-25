import { db } from '@/db'
import { transactionSchema } from '@/domain/schemas'
import type { Transaction } from '@/domain/types'

export async function getTransaction(id: string): Promise<Transaction | undefined> {
  return db.transactions.get(id)
}

export async function listAllTransactions(includeDeleted = false): Promise<Transaction[]> {
  const rows = await db.transactions.toArray()
  const filtered = includeDeleted ? rows : rows.filter((tx) => tx.deletedAt == null)
  return filtered.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  )
}

export async function listRecentTransactions(limit = 50): Promise<Transaction[]> {
  const rows = await listAllTransactions(false)
  return rows.slice(0, limit)
}

export async function listTransactionsByTransferId(
  transferId: string,
  includeDeleted = false,
): Promise<Transaction[]> {
  const rows = await db.transactions.where('linkedTransferId').equals(transferId).toArray()
  return includeDeleted ? rows : rows.filter((tx) => tx.deletedAt == null)
}

export async function saveTransaction(transaction: Transaction): Promise<Transaction> {
  const parsed = transactionSchema.parse(transaction)
  await db.transactions.put(parsed)
  return parsed
}

export async function saveTransactions(transactions: Transaction[]): Promise<Transaction[]> {
  const parsed = transactions.map((tx) => transactionSchema.parse(tx))
  await db.transactions.bulkPut(parsed)
  return parsed
}

export async function softDeleteTransactionById(
  id: string,
  deletedAt: string,
): Promise<Transaction | null> {
  const existing = await db.transactions.get(id)
  if (!existing || existing.deletedAt != null) return null
  const next = transactionSchema.parse({
    ...existing,
    deletedAt,
    updatedAt: deletedAt,
  })
  await db.transactions.put(next)
  return next
}

export async function softDeleteTransactionsByIds(
  ids: string[],
  deletedAt: string,
): Promise<number> {
  let count = 0
  await db.transaction('rw', db.transactions, async () => {
    for (const id of ids) {
      const next = await softDeleteTransactionById(id, deletedAt)
      if (next) count += 1
    }
  })
  return count
}
