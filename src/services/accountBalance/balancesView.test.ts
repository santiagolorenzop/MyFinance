import { describe, expect, it } from 'vitest'
import {
  buildBalancesView,
  recentTransactionsForAccount,
} from '@/services/accountBalance'
import {
  makeAccount,
  makeExpense,
  makeIncome,
  treatments,
} from '@/test/fixtures/engineFixtures'

describe('balancesView', () => {
  it('totals by currency without mixing and respects includeInTotalNetBalance', () => {
    const usd = makeAccount({
      id: 'acc-usd',
      name: 'USD',
      currencyCode: 'USD',
      initialBalanceMinor: 1000,
      includeInTotalNetBalance: true,
    })
    const usdHidden = makeAccount({
      id: 'acc-hidden',
      name: 'Hidden',
      currencyCode: 'USD',
      initialBalanceMinor: 5000,
      includeInTotalNetBalance: false,
    })
    const cop = makeAccount({
      id: 'acc-cop',
      name: 'COP',
      currencyCode: 'COP',
      initialBalanceMinor: 100,
      includeInTotalNetBalance: true,
    })

    const ledger = [
      makeExpense({
        id: 'tx-1',
        title: 'Coffee',
        accountId: 'acc-usd',
        originalAmountMinor: 300,
        date: '2026-07-20',
      }),
    ]

    const view = buildBalancesView([usd, usdHidden, cop], ledger, treatments)
    expect(view.accountBalances).toHaveLength(3)
    expect(view.totalsByCurrency.USD).toBe(700)
    expect(view.totalsByCurrency.COP).toBe(100)
  })

  it('lists recent account transactions newest first', () => {
    const rows = recentTransactionsForAccount(
      [
        makeIncome({
          id: 'tx-a',
          title: 'Pay',
          accountId: 'acc-1',
          originalAmountMinor: 100,
          date: '2026-07-10',
          createdAt: '2026-07-10T10:00:00.000Z',
        }),
        makeExpense({
          id: 'tx-b',
          title: 'Food',
          accountId: 'acc-1',
          originalAmountMinor: 50,
          date: '2026-07-20',
          createdAt: '2026-07-20T10:00:00.000Z',
        }),
        makeExpense({
          id: 'tx-c',
          title: 'Other',
          accountId: 'acc-2',
          originalAmountMinor: 10,
          date: '2026-07-21',
        }),
      ],
      'acc-1',
    )
    expect(rows.map((row) => row.id)).toEqual(['tx-b', 'tx-a'])
  })
})
