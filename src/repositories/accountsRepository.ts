import { db } from '@/db'
import type { AccountType } from '@/domain/enums'
import { accountSchema } from '@/domain/schemas'
import type { Account } from '@/domain/types'
import { todayFinancialDate } from '@/utils/dates'
import { IntegrityError, accountHasTransactions } from '@/repositories/integrity'
import {
  planAccountUpdate,
  type AccountUpdateRequest,
} from '@/services/account/accountUpdateService'

export interface AccountInput {
  name: string
  type: AccountType
  currencyCode: string
  initialBalanceMinor: number
  initialBalanceDate?: string
  isDefault?: boolean
  notes?: string | null
  includeInTotalNetBalance?: boolean
}

export async function listAccounts(includeArchived = false): Promise<Account[]> {
  const rows = await db.accounts.orderBy('sortOrder').toArray()
  return includeArchived ? rows : rows.filter((row) => row.archivedAt == null)
}

export async function getAccount(id: string): Promise<Account | undefined> {
  return db.accounts.get(id)
}

export async function createAccount(input: AccountInput): Promise<Account> {
  const now = new Date().toISOString()
  const count = await db.accounts.count()
  const account = accountSchema.parse({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    type: input.type,
    currencyCode: input.currencyCode,
    initialBalanceMinor: input.initialBalanceMinor,
    initialBalanceDate: input.initialBalanceDate ?? todayFinancialDate(),
    icon: null,
    sortOrder: count,
    isDefault: input.isDefault ?? count === 0,
    isActive: true,
    includeInTotalNetBalance: input.includeInTotalNetBalance ?? true,
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  })

  await db.transaction('rw', db.accounts, db.settings, async () => {
    if (account.isDefault) {
      const others = await db.accounts.toArray()
      await Promise.all(
        others.map((row) => db.accounts.update(row.id, { isDefault: false })),
      )
    }
    await db.accounts.add(account)
    if (account.isDefault) {
      const settings = await db.settings.toCollection().first()
      if (settings) {
        await db.settings.update(settings.id, {
          defaultAccountId: account.id,
          updatedAt: now,
        })
      }
    }
  })

  return account
}

/**
 * Update an account after safe-edit planning.
 * Sensitive currency/initial-balance changes are blocked when history exists.
 */
export async function updateAccount(
  id: string,
  patch: AccountUpdateRequest,
): Promise<{ account: Account; warnings: string[] }> {
  const existing = await db.accounts.get(id)
  const hasTransactions = await accountHasTransactions(id)
  const planned = planAccountUpdate({ existing, patch, hasTransactions })
  if (!planned.ok) {
    throw new IntegrityError(planned.error)
  }

  if (!existing) throw new Error('Account not found')

  const now = new Date().toISOString()
  let next = accountSchema.parse({
    ...existing,
    name: planned.patch.name?.trim() ?? existing.name,
    type: planned.patch.type ?? existing.type,
    currencyCode: planned.patch.currencyCode ?? existing.currencyCode,
    initialBalanceMinor:
      planned.patch.initialBalanceMinor ?? existing.initialBalanceMinor,
    initialBalanceDate:
      planned.patch.initialBalanceDate ?? existing.initialBalanceDate,
    includeInTotalNetBalance:
      planned.patch.includeInTotalNetBalance ?? existing.includeInTotalNetBalance,
    isActive: planned.patch.isActive ?? existing.isActive,
    isDefault: planned.patch.isDefault ?? existing.isDefault,
    notes:
      planned.patch.notes !== undefined ? planned.patch.notes : existing.notes,
    icon: planned.patch.icon !== undefined ? planned.patch.icon : existing.icon,
    updatedAt: now,
  })

  if (planned.patch.archive) {
    next = accountSchema.parse({
      ...next,
      isActive: false,
      isDefault: false,
      archivedAt: now,
    })
  } else if (planned.patch.isActive === false) {
    next = accountSchema.parse({
      ...next,
      isDefault: false,
    })
  }

  await db.transaction('rw', db.accounts, db.settings, async () => {
    if (next.isDefault) {
      const others = await db.accounts.toArray()
      await Promise.all(
        others
          .filter((row) => row.id !== id)
          .map((row) => db.accounts.update(row.id, { isDefault: false })),
      )
      const settings = await db.settings.toCollection().first()
      if (settings) {
        await db.settings.update(settings.id, {
          defaultAccountId: id,
          updatedAt: now,
        })
      }
    }
    await db.accounts.put(next)
  })

  return { account: next, warnings: planned.warnings }
}

export async function archiveAccount(id: string): Promise<Account> {
  const result = await updateAccount(id, { archive: true })
  return result.account
}

/** Hard delete only when there is no transaction history. */
export async function deleteAccount(id: string): Promise<void> {
  if (await accountHasTransactions(id)) {
    throw new IntegrityError(
      'This account cannot be deleted because it has transaction history. Archive it instead.',
    )
  }
  await db.accounts.delete(id)
}
