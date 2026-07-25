import { describe, expect, it } from 'vitest'
import { calculateAccountBalance } from '@/services/accountBalance'
import { sumEligibleSpentMinor } from '@/services/budget'
import { getPeriodForDate } from '@/services/period'
import {
  applySuccessfulExpenseSave,
  createExpenseTransaction,
  replaceUndoSessionOnNewSave,
  undoExpense,
} from '@/services/transaction'
import {
  currencies,
  makeAccount,
  makeCategory,
  makeExpense,
  treatments,
} from '@/test/fixtures/engineFixtures'

describe('transactionService', () => {
  const account = makeAccount({
    id: 'acc-1',
    name: 'Main Checking',
    currencyCode: 'USD',
    initialBalanceMinor: 10000,
  })

  function saveExpense(amount: number, title: string, categoryId: string | null, atMs: number) {
    const created = createExpenseTransaction({
      date: '2026-07-18',
      title,
      accountId: 'acc-1',
      categoryId,
      treatmentId: 'treat-monthly',
      originalAmountMinor: amount,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies,
      createdAt: new Date(atMs).toISOString(),
      updatedAt: new Date(atMs).toISOString(),
    })
    expect(created.ok).toBe(true)
    if (!created.ok) throw new Error('create failed')
    return created.transaction
  }

  it('saves and undoes an expense with balance and monthly-stat recalculation', () => {
    const t0 = Date.parse('2026-07-18T12:00:00.000Z')
    const tx = saveExpense(2500, 'Lunch', 'cat-food', t0)
    const saved = applySuccessfulExpenseSave({
      ledger: [],
      memory: [],
      transaction: tx,
      savedAtMs: t0,
    })

    expect(calculateAccountBalance(account, saved.ledger, treatments).balanceMinor).toBe(7500)

    const period = getPeriodForDate(16, '2026-07-20')
    expect(
      sumEligibleSpentMinor(saved.ledger, treatments, {
        period,
        today: '2026-07-20',
      }),
    ).toBe(2500)

    const undone = undoExpense({
      session: saved.session,
      nowMs: t0 + 1000,
      ledger: saved.ledger,
      memory: saved.memory,
    })
    expect(undone.ok).toBe(true)
    if (!undone.ok) return

    expect(calculateAccountBalance(account, undone.ledger, treatments).balanceMinor).toBe(10000)
    expect(
      sumEligibleSpentMinor(undone.ledger, treatments, {
        period,
        today: '2026-07-20',
      }),
    ).toBe(0)
    expect(undone.memory).toHaveLength(0)
  })

  it('undoes an over-budget category transaction', () => {
    const existing = makeExpense({
      id: 'existing',
      title: 'Prior',
      accountId: 'acc-1',
      categoryId: 'cat-food',
      originalAmountMinor: 19000,
      date: '2026-07-17',
    })
    const t0 = Date.parse('2026-07-18T12:00:00.000Z')
    const tx = saveExpense(2000, 'Extra', 'cat-food', t0)
    const saved = applySuccessfulExpenseSave({
      ledger: [existing],
      memory: [],
      transaction: tx,
      savedAtMs: t0,
    })
    const period = getPeriodForDate(16, '2026-07-20')
    expect(
      sumEligibleSpentMinor(saved.ledger, treatments, {
        period,
        today: '2026-07-20',
      }),
    ).toBe(21000)

    const undone = undoExpense({
      session: saved.session,
      nowMs: t0 + 500,
      ledger: saved.ledger,
      memory: saved.memory,
    })
    expect(undone.ok).toBe(true)
    if (!undone.ok) return
    expect(
      sumEligibleSpentMinor(undone.ledger, treatments, {
        period,
        today: '2026-07-20',
      }),
    ).toBe(19000)
  })

  it('rejects undo after timeout', () => {
    const t0 = Date.parse('2026-07-18T12:00:00.000Z')
    const tx = saveExpense(1000, 'Coffee', null, t0)
    const saved = applySuccessfulExpenseSave({
      ledger: [],
      memory: [],
      transaction: tx,
      savedAtMs: t0,
    })
    const result = undoExpense({
      session: saved.session,
      nowMs: t0 + 5001,
      ledger: saved.ledger,
      memory: saved.memory,
    })
    expect(result).toEqual({ ok: false, reason: 'expired' })
    expect(saved.ledger.filter((row) => row.deletedAt == null)).toHaveLength(1)
  })

  it('replaces undo target when a second expense is saved', () => {
    const t0 = Date.parse('2026-07-18T12:00:00.000Z')
    const first = saveExpense(1000, 'One', null, t0)
    const firstSave = applySuccessfulExpenseSave({
      ledger: [],
      memory: [],
      transaction: first,
      savedAtMs: t0,
    })

    const t1 = t0 + 1000
    const second = saveExpense(2000, 'Two', null, t1)
    const secondSave = applySuccessfulExpenseSave({
      ledger: firstSave.ledger,
      memory: firstSave.memory,
      transaction: second,
      savedAtMs: t1,
    })
    const session = replaceUndoSessionOnNewSave(firstSave.session, second.id, t1)
    expect(session.transactionId).toBe(second.id)

    const undone = undoExpense({
      session,
      nowMs: t1 + 100,
      ledger: secondSave.ledger,
      memory: secondSave.memory,
    })
    expect(undone.ok).toBe(true)
    if (!undone.ok) return

    const active = undone.ledger.filter((row) => row.deletedAt == null)
    expect(active).toHaveLength(1)
    expect(active[0]?.title).toBe('One')
  })

  it('preserves draft on failed save and clears draft flag on success', () => {
    const failed = createExpenseTransaction({
      date: '2026-07-18',
      title: 'No amount',
      accountId: 'acc-1',
      treatmentId: 'treat-monthly',
      originalAmountMinor: 0,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    })
    expect(failed.ok).toBe(false)
    if (failed.ok) return
    expect(failed.preserveDraft).toBe(true)

    const ok = createExpenseTransaction({
      date: '2026-07-18',
      title: 'Almuerzo Sara',
      accountId: 'acc-1',
      categoryId: makeCategory({ id: 'cat-food', name: 'Food' }).id,
      treatmentId: 'treat-monthly',
      originalAmountMinor: 2800,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies,
      createdAt: '2026-07-18T00:00:00.000Z',
      updatedAt: '2026-07-18T00:00:00.000Z',
    })
    expect(ok.ok).toBe(true)
    if (!ok.ok) return
    const saved = applySuccessfulExpenseSave({
      ledger: [],
      memory: [],
      transaction: ok.transaction,
      savedAtMs: Date.parse('2026-07-18T00:00:00.000Z'),
    })
    expect(saved.clearDraft).toBe(true)
    expect(ok.transaction.title).toBe('Almuerzo Sara')
  })
})
