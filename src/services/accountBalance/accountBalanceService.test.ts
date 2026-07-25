import { describe, expect, it } from 'vitest'
import { calculateAccountBalance } from '@/services/accountBalance'
import {
  currencies,
  makeAccount,
  makeExpense,
  makeIncome,
  treatments,
} from '@/test/fixtures/engineFixtures'
import { createTransferLegs, upsertTransferInLedger } from '@/services/transfer'

describe('accountBalanceService', () => {
  it('calculates balance after income', () => {
    const account = makeAccount({
      id: 'acc-1',
      name: 'Main Checking',
      currencyCode: 'USD',
      initialBalanceMinor: 10000,
    })
    const balance = calculateAccountBalance(
      account,
      [
        makeIncome({
          id: 'inc-1',
          title: 'Paycheck',
          accountId: 'acc-1',
          originalAmountMinor: 50000,
          date: '2026-07-01',
        }),
      ],
      treatments,
    )
    expect(balance.balanceMinor).toBe(60000)
  })

  it('calculates balance after expense', () => {
    const account = makeAccount({
      id: 'acc-1',
      name: 'Main Checking',
      currencyCode: 'USD',
      initialBalanceMinor: 10000,
    })
    const balance = calculateAccountBalance(
      account,
      [
        makeExpense({
          id: 'exp-1',
          title: 'Lunch',
          accountId: 'acc-1',
          originalAmountMinor: 2500,
          date: '2026-07-01',
        }),
      ],
      treatments,
    )
    expect(balance.balanceMinor).toBe(7500)
  })

  it('allows negative credit-card balances', () => {
    const card = makeAccount({
      id: 'acc-cc',
      name: 'Credit Card',
      type: 'credit_card',
      currencyCode: 'USD',
      initialBalanceMinor: 0,
    })
    const balance = calculateAccountBalance(
      card,
      [
        makeExpense({
          id: 'exp-1',
          title: 'Purchase',
          accountId: 'acc-cc',
          originalAmountMinor: 12000,
          date: '2026-07-01',
        }),
      ],
      treatments,
    )
    expect(balance.balanceMinor).toBe(-12000)
  })

  it('calculates USD and COP accounts independently', () => {
    const usd = makeAccount({
      id: 'acc-usd',
      name: 'USD Cash',
      currencyCode: 'USD',
      initialBalanceMinor: 5000,
    })
    const cop = makeAccount({
      id: 'acc-cop',
      name: 'COP Cash',
      type: 'cash',
      currencyCode: 'COP',
      initialBalanceMinor: 100000,
    })
    expect(
      calculateAccountBalance(
        usd,
        [
          makeExpense({
            id: 'e1',
            title: 'Coffee',
            accountId: 'acc-usd',
            originalAmountMinor: 500,
            date: '2026-07-01',
          }),
        ],
        treatments,
      ).balanceMinor,
    ).toBe(4500)

    expect(
      calculateAccountBalance(
        cop,
        [
          makeExpense({
            id: 'e2',
            title: 'Taxi',
            accountId: 'acc-cop',
            originalAmountMinor: 15000,
            originalCurrencyCode: 'COP',
            accountCurrencyCode: 'COP',
            baseCurrencyAmountMinor: null,
            date: '2026-07-01',
          }),
        ],
        treatments,
      ).balanceMinor,
    ).toBe(85000)
    expect(currencies.COP.decimalPlaces).toBe(0)
  })

  it('applies same-currency transfer to both accounts', () => {
    const source = makeAccount({
      id: 'acc-a',
      name: 'A',
      currencyCode: 'USD',
      initialBalanceMinor: 10000,
    })
    const dest = makeAccount({
      id: 'acc-b',
      name: 'B',
      currencyCode: 'USD',
      initialBalanceMinor: 0,
    })
    const legs = createTransferLegs({
      transferId: 'xfer-1',
      date: '2026-07-01',
      title: 'Move',
      sourceAccountId: 'acc-a',
      destinationAccountId: 'acc-b',
      sourceAmountMinor: 3000,
      sourceCurrencyCode: 'USD',
      destinationAmountMinor: 3000,
      destinationCurrencyCode: 'USD',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    const ledger = upsertTransferInLedger([], legs)
    expect(calculateAccountBalance(source, ledger, treatments).balanceMinor).toBe(7000)
    expect(calculateAccountBalance(dest, ledger, treatments).balanceMinor).toBe(3000)
  })
})
