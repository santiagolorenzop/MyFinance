import { db } from '@/db'

export async function accountHasTransactions(accountId: string): Promise<boolean> {
  const count = await db.transactions.where('accountId').equals(accountId).count()
  if (count > 0) return true
  const asDest = await db.transactions
    .filter((tx) => tx.destinationAccountId === accountId)
    .count()
  return asDest > 0
}

export async function categoryHasTransactions(categoryId: string): Promise<boolean> {
  const count = await db.transactions.where('categoryId').equals(categoryId).count()
  return count > 0
}

export async function fundHasTransactions(fundId: string): Promise<boolean> {
  const count = await db.transactions.where('fundId').equals(fundId).count()
  return count > 0
}

export async function treatmentHasTransactions(treatmentId: string): Promise<boolean> {
  const count = await db.transactions.where('treatmentId').equals(treatmentId).count()
  return count > 0
}

export class IntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'IntegrityError'
  }
}
