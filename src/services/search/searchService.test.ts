import { describe, expect, it } from 'vitest'
import { resolveSearchResults, searchTransactions } from '@/services/search'
import {
  makeAccount,
  makeCategory,
  makeExpense,
  treatments,
} from '@/test/fixtures/engineFixtures'

describe('searchService', () => {
  const food = makeCategory({ id: 'cat-food', name: 'Food' })
  const archivedFood = makeCategory({
    id: 'cat-old-food',
    name: 'Comida',
    archivedAt: '2026-06-01T00:00:00.000Z',
    isActive: false,
  })
  const chase = makeAccount({
    id: 'acc-chase',
    name: 'Chase Debit',
    currencyCode: 'USD',
  })

  const txs = [
    makeExpense({
      id: 'tx-1',
      title: 'Almuerzo Sara',
      accountId: 'acc-chase',
      categoryId: 'cat-food',
      originalAmountMinor: 2800,
      date: '2026-07-18',
    }),
    makeExpense({
      id: 'tx-2',
      title: 'Uber aeropuerto',
      accountId: 'acc-chase',
      categoryId: 'cat-transport',
      originalAmountMinor: 3500,
      date: '2026-07-19',
    }),
    makeExpense({
      id: 'tx-3',
      title: 'Old market',
      accountId: 'acc-chase',
      categoryId: 'cat-old-food',
      originalAmountMinor: 1000,
      date: '2026-05-01',
    }),
  ]

  const transport = makeCategory({ id: 'cat-transport', name: 'Transportation' })

  const context = {
    transactions: txs,
    categories: [food, transport, archivedFood],
    accounts: [chase],
    funds: [],
    treatments,
  }

  it('keeps title independent from category and finds both', () => {
    const bySara = searchTransactions('Sara', context)
    const byFood = searchTransactions('Food', context)
    const saraTx = resolveSearchResults(bySara, txs).find(
      (row) => row.transaction.id === 'tx-1',
    )
    expect(saraTx?.transaction.title).toBe('Almuerzo Sara')
    expect(byFood.some((m) => m.transactionId === 'tx-1')).toBe(true)
    expect(byFood.find((m) => m.transactionId === 'tx-1')?.matchedFields).toContain(
      'category',
    )
  })

  it('searches by title, category, and account', () => {
    expect(searchTransactions('Uber', context).map((m) => m.transactionId)).toContain('tx-2')
    expect(searchTransactions('Transportation', context).map((m) => m.transactionId)).toContain(
      'tx-2',
    )
    expect(searchTransactions('Chase', context).length).toBeGreaterThan(0)
  })

  it('is case-insensitive and accent-insensitive', () => {
    expect(searchTransactions('almuerzo', context).map((m) => m.transactionId)).toContain('tx-1')
    expect(searchTransactions('COMIDA', context).map((m) => m.transactionId)).toContain('tx-3')
  })

  it('never mutates financial data', () => {
    const before = structuredClone(txs)
    searchTransactions('Sara', context)
    expect(txs).toEqual(before)
  })

  it('exposes match reason when match is not via title', () => {
    const match = searchTransactions('Food', context).find((m) => m.transactionId === 'tx-1')
    expect(match?.matchedFields).toContain('category')
    expect(match?.matchedFields.includes('title')).toBe(false)
  })

  it('keeps archived category visible on historical transactions via search', () => {
    const match = searchTransactions('Comida', context).find((m) => m.transactionId === 'tx-3')
    expect(match).toBeTruthy()
    const resolved = resolveSearchResults([match!], txs)[0]
    expect(resolved?.transaction.categoryId).toBe('cat-old-food')
    expect(resolved?.transaction.title).toBe('Old market')
  })
})
