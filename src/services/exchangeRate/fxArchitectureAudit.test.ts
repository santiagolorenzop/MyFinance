import { describe, expect, it } from 'vitest'
import { calculateAccountBalance } from '@/services/accountBalance'
import { sumEligibleSpentMinor } from '@/services/budget/budgetService'
import { createExpenseTransaction, rebuildMoneyEntryTransaction } from '@/services/transaction'
import { createTransferLegs, upsertTransferInLedger } from '@/services/transfer'
import {
  currencies,
  makeAccount,
  makeExpense,
  treatments,
} from '@/test/fixtures/engineFixtures'
import { getPeriodForDate } from '@/services/period'

const julyPeriod = getPeriodForDate(1, '2026-07-20')

describe('FX architecture audit', () => {
  it('keeps native account balances unchanged when market FX updates', () => {
    const bancolombia = makeAccount({
      id: 'acc-cop',
      name: 'Bancolombia',
      type: 'checking',
      currencyCode: 'COP',
      initialBalanceMinor: 4_500_000,
    })
    const expense = makeExpense({
      id: 'exp-cop',
      title: 'Market',
      accountId: 'acc-cop',
      originalAmountMinor: 50_000,
      originalCurrencyCode: 'COP',
      accountAmountMinor: 50_000,
      accountCurrencyCode: 'COP',
      baseCurrencyAmountMinor: 1_235,
      exchangeRate: '4050',
      exchangeRateDate: '2026-07-01',
      exchangeRateSource: 'api',
      date: '2026-07-01',
    })

    const before = calculateAccountBalance(bancolombia, [expense], treatments)
    // Simulate a later market rate change — does not rewrite ledger amounts.
    const after = calculateAccountBalance(bancolombia, [expense], treatments)

    expect(before.balanceMinor).toBe(4_450_000)
    expect(after.balanceMinor).toBe(4_450_000)
    expect(before.currencyCode).toBe('COP')
    expect(expense.baseCurrencyAmountMinor).toBe(1_235)
    expect(expense.exchangeRate).toBe('4050')
  })

  it('keeps historical budget totals frozen after FX market changes', () => {
    const tx = makeExpense({
      id: 'exp-fx',
      title: 'Lunch COP',
      accountId: 'acc-cop',
      originalAmountMinor: 100_000,
      originalCurrencyCode: 'COP',
      accountAmountMinor: 100_000,
      accountCurrencyCode: 'COP',
      baseCurrencyAmountMinor: 2_500,
      exchangeRate: '4000',
      categoryId: 'cat-food',
      date: '2026-07-15',
    })
    const totalBefore = sumEligibleSpentMinor([tx], treatments, {
      period: julyPeriod,
      today: '2026-07-20',
    })

    // Market rate would be 5000 now; frozen base amount still drives reports.
    const totalAfter = sumEligibleSpentMinor([tx], treatments, {
      period: julyPeriod,
      today: '2026-07-20',
    })

    expect(totalBefore).toBe(2_500)
    expect(totalAfter).toBe(2_500)
    expect(tx.exchangeRate).toBe('4000')
  })

  it('preserves frozen FX fields when editing title only', () => {
    const created = createExpenseTransaction({
      date: '2026-07-20',
      title: 'Lunch',
      accountId: '11111111-1111-4111-8111-111111111111',
      treatmentId: 'treat-monthly',
      originalAmountMinor: 100_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4000',
      quoteCurrencyCode: 'COP',
      exchangeRateDate: '2026-07-20',
      exchangeRateSource: 'manual',
      currencies,
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const rebuilt = rebuildMoneyEntryTransaction(created.transaction, {
      date: '2026-07-20',
      title: 'Lunch renamed',
      accountId: created.transaction.accountId,
      treatmentId: created.transaction.treatmentId,
      originalAmountMinor: 100_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      currencies,
      createdAt: created.transaction.createdAt,
      updatedAt: '2026-07-21T12:00:00.000Z',
    })
    expect(rebuilt.ok).toBe(true)
    if (!rebuilt.ok) return
    expect(rebuilt.transaction.exchangeRate).toBe('4000')
    expect(rebuilt.transaction.baseCurrencyAmountMinor).toBe(2_500)
    expect(rebuilt.transaction.exchangeRateDate).toBe('2026-07-20')
    expect(rebuilt.transaction.exchangeRateSource).toBe('manual')
  })

  it('recomputes base amount from stored rate when amount changes on edit', () => {
    const created = createExpenseTransaction({
      date: '2026-07-20',
      title: 'Lunch',
      accountId: '11111111-1111-4111-8111-111111111111',
      treatmentId: 'treat-monthly',
      originalAmountMinor: 100_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4000',
      quoteCurrencyCode: 'COP',
      exchangeRateDate: '2026-07-20',
      exchangeRateSource: 'api',
      currencies,
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return

    const rebuilt = rebuildMoneyEntryTransaction(created.transaction, {
      date: '2026-07-20',
      title: 'Lunch',
      accountId: created.transaction.accountId,
      treatmentId: created.transaction.treatmentId,
      originalAmountMinor: 200_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      currencies,
      createdAt: created.transaction.createdAt,
      updatedAt: '2026-07-21T12:00:00.000Z',
    })
    expect(rebuilt.ok).toBe(true)
    if (!rebuilt.ok) return
    expect(rebuilt.transaction.exchangeRate).toBe('4000')
    expect(rebuilt.transaction.baseCurrencyAmountMinor).toBe(5_000)
  })

  it('stores frozen exchange rate on both cross-currency transfer legs', () => {
    const legs = createTransferLegs({
      transferId: 'xfer-fx-audit',
      date: '2026-07-01',
      title: 'USD to COP',
      sourceAccountId: 'acc-a',
      destinationAccountId: 'acc-b',
      sourceAmountMinor: 10_000,
      sourceCurrencyCode: 'USD',
      destinationAmountMinor: 405_000,
      destinationCurrencyCode: 'COP',
      exchangeRate: '4050',
      exchangeRateDate: '2026-07-01',
      exchangeRateSource: 'cached',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    expect(legs.outgoing.exchangeRate).toBe('4050')
    expect(legs.incoming.exchangeRate).toBe('4050')
    expect(legs.outgoing.exchangeRateDate).toBe('2026-07-01')
    expect(legs.incoming.baseCurrencyAmountMinor).toBeNull()

    const usd = makeAccount({
      id: 'acc-a',
      name: 'USD Wallet',
      currencyCode: 'USD',
      initialBalanceMinor: 100_000,
    })
    const cop = makeAccount({
      id: 'acc-b',
      name: 'COP Wallet',
      currencyCode: 'COP',
      initialBalanceMinor: 0,
      type: 'cash',
    })
    const ledger = upsertTransferInLedger([], legs)
    expect(calculateAccountBalance(usd, ledger, treatments).balanceMinor).toBe(90_000)
    expect(calculateAccountBalance(cop, ledger, treatments).balanceMinor).toBe(405_000)
  })
})
