import { describe, expect, it } from 'vitest'
import {
  EMPTY_MOVEMENT_FILTERS,
  filterMovements,
  queryMovements,
  toMovementListRows,
} from '@/services/movement'
import {
  makeAccount,
  makeCategory,
  makeExpense,
  makeIncome,
  treatments,
} from '@/test/fixtures/engineFixtures'
import { createTransferLegs, upsertTransferInLedger } from '@/services/transfer'

describe('movementQueryService', () => {
  const accounts = [
    makeAccount({ id: 'acc-1', name: 'Checking', currencyCode: 'USD' }),
    makeAccount({ id: 'acc-2', name: 'Savings', currencyCode: 'USD' }),
  ]
  const categories = [makeCategory({ id: 'cat-food', name: 'Food' })]

  it('hides incoming transfer legs in list rows', () => {
    const legs = createTransferLegs({
      transferId: 'xfer-1',
      date: '2026-07-24',
      title: 'Move',
      sourceAccountId: 'acc-1',
      destinationAccountId: 'acc-2',
      sourceAmountMinor: 1000,
      sourceCurrencyCode: 'USD',
      destinationAmountMinor: 1000,
      destinationCurrencyCode: 'USD',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-24T00:00:00.000Z',
      updatedAt: '2026-07-24T00:00:00.000Z',
    })
    const ledger = upsertTransferInLedger(
      [
        makeExpense({
          id: 'tx-e',
          title: 'Coffee',
          accountId: 'acc-1',
          originalAmountMinor: 300,
          date: '2026-07-23',
          categoryId: 'cat-food',
        }),
      ],
      legs,
    )

    const rows = toMovementListRows(ledger)
    expect(rows).toHaveLength(2)
    expect(rows.some((tx) => tx.id === legs.incoming.id)).toBe(false)
    expect(rows.some((tx) => tx.id === legs.outgoing.id)).toBe(true)
  })

  it('filters by type and searches without mutating titles', () => {
    const transactions = [
      makeExpense({
        id: 'tx-1',
        title: 'Almuerzo Sara',
        accountId: 'acc-1',
        originalAmountMinor: 2000,
        date: '2026-07-20',
        categoryId: 'cat-food',
      }),
      makeIncome({
        id: 'tx-2',
        title: 'Salary',
        accountId: 'acc-1',
        originalAmountMinor: 5000,
        date: '2026-07-21',
      }),
    ]

    const expensesOnly = filterMovements(transactions, {
      ...EMPTY_MOVEMENT_FILTERS,
      types: ['expense'],
    })
    expect(expensesOnly).toHaveLength(1)

    const results = queryMovements({
      transactions,
      filters: EMPTY_MOVEMENT_FILTERS,
      searchQuery: 'Food',
      searchContext: {
        categories,
        accounts,
        funds: [],
        treatments,
      },
    })
    expect(results).toHaveLength(1)
    expect(results[0]?.transaction.title).toBe('Almuerzo Sara')
    expect(results[0]?.matchedFields).toContain('category')
  })

  it('filters by category', () => {
    const transactions = [
      makeExpense({
        id: 'tx-food',
        title: 'Groceries',
        accountId: 'acc-1',
        originalAmountMinor: 2000,
        date: '2026-07-20',
        categoryId: 'cat-food',
      }),
      makeExpense({
        id: 'tx-other',
        title: 'Taxi',
        accountId: 'acc-1',
        originalAmountMinor: 1500,
        date: '2026-07-20',
        categoryId: 'cat-transport',
      }),
      makeExpense({
        id: 'tx-uncat',
        title: 'Misc',
        accountId: 'acc-1',
        originalAmountMinor: 500,
        date: '2026-07-20',
        categoryId: null,
      }),
    ]
    const foodOnly = filterMovements(transactions, {
      ...EMPTY_MOVEMENT_FILTERS,
      categoryIds: ['cat-food'],
    })
    expect(foodOnly.map((tx) => tx.id)).toEqual(['tx-food'])
  })

  it('filters by account', () => {
    const transactions = [
      makeExpense({
        id: 'tx-checking',
        title: 'Coffee',
        accountId: 'acc-1',
        originalAmountMinor: 300,
        date: '2026-07-20',
        categoryId: 'cat-food',
      }),
      makeExpense({
        id: 'tx-savings',
        title: 'Transfer fee',
        accountId: 'acc-2',
        originalAmountMinor: 100,
        date: '2026-07-20',
        categoryId: 'cat-food',
      }),
    ]
    const checkingOnly = filterMovements(transactions, {
      ...EMPTY_MOVEMENT_FILTERS,
      accountIds: ['acc-1'],
    })
    expect(checkingOnly.map((tx) => tx.id)).toEqual(['tx-checking'])
  })

  it('combines category and account filters with search', () => {
    const transactions = [
      makeExpense({
        id: 'tx-match',
        title: 'Lunch',
        accountId: 'acc-1',
        originalAmountMinor: 2000,
        date: '2026-07-20',
        categoryId: 'cat-food',
      }),
      makeExpense({
        id: 'tx-wrong-account',
        title: 'Lunch',
        accountId: 'acc-2',
        originalAmountMinor: 2000,
        date: '2026-07-20',
        categoryId: 'cat-food',
      }),
      makeExpense({
        id: 'tx-wrong-category',
        title: 'Lunch',
        accountId: 'acc-1',
        originalAmountMinor: 2000,
        date: '2026-07-20',
        categoryId: 'cat-transport',
      }),
    ]
    const results = queryMovements({
      transactions,
      filters: {
        ...EMPTY_MOVEMENT_FILTERS,
        accountIds: ['acc-1'],
        categoryIds: ['cat-food'],
      },
      searchQuery: 'Lunch',
      searchContext: {
        categories: [
          makeCategory({ id: 'cat-food', name: 'Food' }),
          makeCategory({ id: 'cat-transport', name: 'Transportation' }),
        ],
        accounts,
        funds: [],
        treatments,
      },
    })
    expect(results.map((row) => row.transaction.id)).toEqual(['tx-match'])
  })

  it('clearing filters restores all list rows', () => {
    const transactions = [
      makeExpense({
        id: 'tx-1',
        title: 'A',
        accountId: 'acc-1',
        originalAmountMinor: 100,
        date: '2026-07-20',
        categoryId: 'cat-food',
      }),
      makeExpense({
        id: 'tx-2',
        title: 'B',
        accountId: 'acc-2',
        originalAmountMinor: 200,
        date: '2026-07-21',
        categoryId: 'cat-food',
      }),
    ]
    const filtered = queryMovements({
      transactions,
      filters: { ...EMPTY_MOVEMENT_FILTERS, accountIds: ['acc-1'] },
      searchQuery: '',
      searchContext: { categories, accounts, funds: [], treatments },
    })
    expect(filtered).toHaveLength(1)

    const cleared = queryMovements({
      transactions,
      filters: EMPTY_MOVEMENT_FILTERS,
      searchQuery: '',
      searchContext: { categories, accounts, funds: [], treatments },
    })
    expect(cleared).toHaveLength(2)
  })
})
