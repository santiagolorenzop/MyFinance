import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { createAccount } from '@/repositories/accountsRepository'
import { createCategory } from '@/repositories/categoriesRepository'
import { getTransaction } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import { saveExpenseFlow } from '@/services/expense'
import {
  deleteMovementFlow,
  duplicateMoneyEntryFlow,
  updateMoneyEntryFlow,
} from '@/services/movement'

describe('movementFlowService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  async function seedExpense() {
    const account = await createAccount({
      name: 'Checking',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 10_000,
      isDefault: true,
    })
    const category = await createCategory({ name: 'Food', kind: 'expense' })
    const settings = await db.settings.toCollection().first()
    const treatmentId = settings?.defaultTreatmentId
    if (!treatmentId) throw new Error('missing treatment')
    const now = new Date().toISOString()
    const saved = await saveExpenseFlow({
      date: '2026-07-20',
      title: 'Lunch',
      accountId: account.id,
      categoryId: category.id,
      treatmentId,
      originalAmountMinor: 1500,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: now,
      updatedAt: now,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) throw new Error('save failed')
    return { account, category, treatmentId, transaction: saved.transaction }
  }

  it('updates an expense through the shared rebuild helper', async () => {
    const { account, category, treatmentId, transaction } = await seedExpense()
    const treatments = await listTreatments()
    void treatments

    const updated = await updateMoneyEntryFlow(transaction.id, {
      date: '2026-07-21',
      title: 'Dinner',
      accountId: account.id,
      categoryId: category.id,
      treatmentId,
      originalAmountMinor: 2200,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: transaction.createdAt,
      updatedAt: new Date().toISOString(),
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.transaction.title).toBe('Dinner')
    expect(updated.transaction.originalAmountMinor).toBe(2200)
    expect(updated.transaction.id).toBe(transaction.id)
  })

  it('duplicates and soft-deletes money entries', async () => {
    const { transaction } = await seedExpense()
    const duplicated = await duplicateMoneyEntryFlow(transaction.id)
    expect(duplicated.ok).toBe(true)
    if (!duplicated.ok) return
    expect(duplicated.transaction.id).not.toBe(transaction.id)
    expect(duplicated.transaction.title).toBe(transaction.title)

    const deleted = await deleteMovementFlow(transaction.id)
    expect(deleted.ok).toBe(true)
    const stored = await getTransaction(transaction.id)
    expect(stored?.deletedAt).not.toBeNull()
  })
})
