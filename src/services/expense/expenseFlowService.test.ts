import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { createAccount } from '@/repositories/accountsRepository'
import { createCategory } from '@/repositories/categoriesRepository'
import { listSuggestions } from '@/repositories/suggestionsRepository'
import { getTransaction } from '@/repositories/transactionsRepository'
import { saveExpenseFlow, undoExpenseFlow } from '@/services/expense'
import { UNDO_TIMEOUT_MS } from '@/config/app'

describe('expenseFlowService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  async function seed() {
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
    if (!treatmentId) throw new Error('missing default treatment')
    return { account, category, treatmentId, settings }
  }

  it('persists an expense and updates suggestion memory', async () => {
    const { account, category, treatmentId, settings } = await seed()
    const now = new Date().toISOString()

    const result = await saveExpenseFlow({
      date: '2026-07-24',
      title: 'Lunch',
      accountId: account.id,
      categoryId: category.id,
      treatmentId,
      originalAmountMinor: 2500,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: settings!.baseCurrency,
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: now,
      updatedAt: now,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const stored = await getTransaction(result.transaction.id)
    expect(stored?.title).toBe('Lunch')
    expect(stored?.deletedAt).toBeNull()

    const memory = await listSuggestions()
    expect(memory).toHaveLength(1)
    expect(memory[0]?.mostUsedCategoryId).toBe(category.id)
    expect(memory[0]?.useCount).toBe(1)
  })

  it('keeps the draft semantics on create failure (invalid amount)', async () => {
    const { account, treatmentId, settings } = await seed()
    const now = new Date().toISOString()

    const result = await saveExpenseFlow({
      date: '2026-07-24',
      title: 'Lunch',
      accountId: account.id,
      treatmentId,
      originalAmountMinor: 0,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: settings!.baseCurrency,
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: now,
      updatedAt: now,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.preserveDraft).toBe(true)
    expect(await db.transactions.count()).toBe(0)
  })

  it('undoes the latest expense within the timeout and reverses memory', async () => {
    const { account, category, treatmentId, settings } = await seed()
    const now = new Date().toISOString()

    const saved = await saveExpenseFlow({
      date: '2026-07-24',
      title: 'Coffee',
      accountId: account.id,
      categoryId: category.id,
      treatmentId,
      originalAmountMinor: 400,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: settings!.baseCurrency,
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: now,
      updatedAt: now,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return

    const undone = await undoExpenseFlow({
      session: saved.session,
      nowMs: saved.session.savedAtMs + 1000,
    })
    expect(undone.ok).toBe(true)

    const stored = await getTransaction(saved.transaction.id)
    expect(stored?.deletedAt).not.toBeNull()
    expect(await listSuggestions()).toHaveLength(0)
  })

  it('rejects undo after timeout', async () => {
    const { account, treatmentId, settings } = await seed()
    const now = new Date().toISOString()

    const saved = await saveExpenseFlow({
      date: '2026-07-24',
      title: 'Bus',
      accountId: account.id,
      treatmentId,
      originalAmountMinor: 200,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: settings!.baseCurrency,
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: now,
      updatedAt: now,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return

    const expired = await undoExpenseFlow({
      session: saved.session,
      nowMs: saved.session.savedAtMs + UNDO_TIMEOUT_MS + 1,
    })
    expect(expired).toEqual({ ok: false, reason: 'expired' })

    const stored = await getTransaction(saved.transaction.id)
    expect(stored?.deletedAt).toBeNull()
  })
})
