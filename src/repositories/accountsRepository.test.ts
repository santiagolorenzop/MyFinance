import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import {
  createAccount,
  deleteAccount,
  IntegrityError,
  updateAccount,
} from '@/repositories'
import { makeExpense } from '@/test/fixtures/engineFixtures'

describe('accountsRepository integrity', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  it('allows deleting an account with no history', async () => {
    const account = await createAccount({
      name: 'Cash',
      type: 'cash',
      currencyCode: 'USD',
      initialBalanceMinor: 0,
    })
    await deleteAccount(account.id)
    expect(await db.accounts.get(account.id)).toBeUndefined()
  })

  it('blocks deleting an account that has transactions', async () => {
    const account = await createAccount({
      name: 'Cash',
      type: 'cash',
      currencyCode: 'USD',
      initialBalanceMinor: 1000,
    })
    await db.transactions.add(
      makeExpense({
        id: crypto.randomUUID(),
        title: 'Coffee',
        accountId: account.id,
        originalAmountMinor: 300,
        date: '2026-07-18',
      }),
    )
    await expect(deleteAccount(account.id)).rejects.toBeInstanceOf(IntegrityError)
  })

  it('persists safe field edits', async () => {
    const account = await createAccount({
      name: 'Cash',
      type: 'cash',
      currencyCode: 'USD',
      initialBalanceMinor: 1000,
    })
    const result = await updateAccount(account.id, {
      name: 'Wallet',
      type: 'digital_wallet',
      includeInTotalNetBalance: false,
      isActive: true,
    })
    expect(result.account.name).toBe('Wallet')
    expect(result.account.type).toBe('digital_wallet')
    expect(result.account.includeInTotalNetBalance).toBe(false)
    const stored = await db.accounts.get(account.id)
    expect(stored?.name).toBe('Wallet')
  })

  it('blocks unsafe currency and initial balance changes when history exists', async () => {
    const account = await createAccount({
      name: 'Cash',
      type: 'cash',
      currencyCode: 'USD',
      initialBalanceMinor: 1000,
    })
    await db.transactions.add(
      makeExpense({
        id: crypto.randomUUID(),
        title: 'Coffee',
        accountId: account.id,
        originalAmountMinor: 300,
        date: '2026-07-18',
      }),
    )
    await expect(
      updateAccount(account.id, { currencyCode: 'EUR' }),
    ).rejects.toBeInstanceOf(IntegrityError)
    await expect(
      updateAccount(account.id, { initialBalanceMinor: 5000 }),
    ).rejects.toBeInstanceOf(IntegrityError)
  })
})
