import { db } from '@/db'
import { fundSchema } from '@/domain/schemas'
import type { Fund } from '@/domain/types'
import { IntegrityError, fundHasTransactions } from '@/repositories/integrity'

export interface FundInput {
  name: string
  description?: string | null
  targetAmountMinor?: number | null
  currencyCode?: string | null
  isDefault?: boolean
}

export async function listFunds(includeArchived = false): Promise<Fund[]> {
  const rows = await db.funds.toArray()
  const filtered = includeArchived ? rows : rows.filter((row) => row.archivedAt == null)
  return filtered.sort((a, b) => a.name.localeCompare(b.name))
}

export async function createFund(input: FundInput): Promise<Fund> {
  const now = new Date().toISOString()
  const count = await db.funds.count()
  const fund = fundSchema.parse({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    description: input.description ?? null,
    targetAmountMinor: input.targetAmountMinor ?? null,
    currencyCode: input.currencyCode ?? null,
    isDefault: input.isDefault ?? count === 0,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  })

  await db.transaction('rw', db.funds, db.settings, async () => {
    if (fund.isDefault) {
      const others = await db.funds.toArray()
      await Promise.all(others.map((row) => db.funds.update(row.id, { isDefault: false })))
    }
    await db.funds.add(fund)
    if (fund.isDefault) {
      const settings = await db.settings.toCollection().first()
      if (settings) {
        await db.settings.update(settings.id, {
          defaultFundId: fund.id,
          updatedAt: now,
        })
      }
    }
  })

  return fund
}

export async function updateFund(id: string, patch: Partial<FundInput>): Promise<Fund> {
  const existing = await db.funds.get(id)
  if (!existing || existing.archivedAt != null) throw new Error('Fund not found')
  const now = new Date().toISOString()
  const next = fundSchema.parse({
    ...existing,
    ...patch,
    name: patch.name?.trim() ?? existing.name,
    updatedAt: now,
  })
  await db.funds.put(next)
  return next
}

export async function archiveFund(id: string): Promise<Fund> {
  const existing = await db.funds.get(id)
  if (!existing) throw new Error('Fund not found')
  const now = new Date().toISOString()
  const next = fundSchema.parse({
    ...existing,
    isActive: false,
    isDefault: false,
    archivedAt: now,
    updatedAt: now,
  })
  await db.funds.put(next)
  return next
}

export async function deleteFund(id: string): Promise<void> {
  if (await fundHasTransactions(id)) {
    throw new IntegrityError(
      'This fund cannot be deleted because it has transaction history. Archive it instead.',
    )
  }
  await db.funds.delete(id)
}
