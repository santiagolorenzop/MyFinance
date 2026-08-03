import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { createAccount } from '@/repositories/accountsRepository'
import { createCategory } from '@/repositories/categoriesRepository'
import { getTransaction, listAllTransactions } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import { calculateAccountBalance } from '@/services/accountBalance'
import { saveExpenseFlow } from '@/services/expense'
import { saveIncomeFlow } from '@/services/income'
import {
  deleteMovementFlow,
  duplicateMoneyEntryFlow,
  EMPTY_MOVEMENT_FILTERS,
  queryMovements,
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

  it('changing account updates filters like an Excel cell edit', async () => {
    const chase = await createAccount({
      name: 'Chase',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 10_000,
      isDefault: true,
    })
    const cra = await createAccount({
      name: 'CRA',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 5_000,
    })
    const category = await createCategory({ name: 'Food', kind: 'expense' })
    const settings = await db.settings.toCollection().first()
    const treatmentId = settings?.defaultTreatmentId
    if (!treatmentId) throw new Error('missing treatment')
    const now = new Date().toISOString()
    const saved = await saveExpenseFlow({
      date: '2026-07-20',
      title: 'Lunch',
      accountId: chase.id,
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
    if (!saved.ok) return

    const updated = await updateMoneyEntryFlow(saved.transaction.id, {
      date: '2026-07-20',
      title: 'Lunch',
      accountId: cra.id,
      categoryId: category.id,
      treatmentId,
      originalAmountMinor: 1500,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: saved.transaction.createdAt,
      updatedAt: new Date().toISOString(),
    })
    expect(updated.ok).toBe(true)
    if (!updated.ok) return
    expect(updated.transaction.accountId).toBe(cra.id)

    const ledger = await listAllTransactions()
    const chaseRows = queryMovements({
      transactions: ledger,
      filters: { ...EMPTY_MOVEMENT_FILTERS, accountIds: [chase.id] },
      searchQuery: '',
      searchContext: { categories: [category], accounts: [chase, cra], funds: [], treatments: [] },
    })
    const craRows = queryMovements({
      transactions: ledger,
      filters: { ...EMPTY_MOVEMENT_FILTERS, accountIds: [cra.id] },
      searchQuery: '',
      searchContext: { categories: [category], accounts: [chase, cra], funds: [], treatments: [] },
    })
    expect(chaseRows.map((row) => row.transaction.id)).not.toContain(saved.transaction.id)
    expect(craRows.map((row) => row.transaction.id)).toContain(saved.transaction.id)
  })

  it('COP income to COP account increases native balance and stores USD reporting amount', async () => {
    const bancolombia = await createAccount({
      name: 'Bancolombia',
      type: 'checking',
      currencyCode: 'COP',
      initialBalanceMinor: 1_000_000,
    })
    const settings = await db.settings.toCollection().first()
    const treatmentId =
      (await listTreatments()).find((row) => row.behaviorKey === 'excluded')?.id ??
      settings?.defaultTreatmentId
    if (!treatmentId) throw new Error('missing treatment')
    const now = new Date().toISOString()
    const saved = await saveIncomeFlow({
      date: '2026-07-20',
      title: 'Salary',
      accountId: bancolombia.id,
      treatmentId,
      originalAmountMinor: 405_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4050',
      quoteCurrencyCode: 'COP',
      exchangeRateDate: '2026-07-20',
      exchangeRateSource: 'cached',
      currencies: {
        USD: { code: 'USD', decimalPlaces: 2 },
        COP: { code: 'COP', decimalPlaces: 0 },
      },
      createdAt: now,
      updatedAt: now,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return
    expect(saved.transaction.originalCurrencyCode).toBe('COP')
    expect(saved.transaction.accountCurrencyCode).toBe('COP')
    expect(saved.transaction.accountAmountMinor).toBe(405_000)
    expect(saved.transaction.baseCurrencyAmountMinor).toBe(10_000)

    const treatments = await listTreatments()
    const balance = calculateAccountBalance(
      bancolombia,
      [saved.transaction],
      treatments,
    )
    expect(balance.balanceMinor).toBe(1_405_000)
    expect(balance.currencyCode).toBe('COP')
  })
})
