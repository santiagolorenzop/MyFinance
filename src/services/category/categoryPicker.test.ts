import { describe, expect, it } from 'vitest'
import { rankCategoriesForPicker, recentTitleSuggestions } from '@/services/category'
import {
  makeCategory,
  makeExpense,
  makeSuggestion,
} from '@/test/fixtures/engineFixtures'

describe('categoryPicker', () => {
  const categories = [
    makeCategory({ id: 'cat-a', name: 'Food', isFavorite: true }),
    makeCategory({ id: 'cat-b', name: 'Transport' }),
    makeCategory({ id: 'cat-c', name: 'Home' }),
    makeCategory({ id: 'cat-d', name: 'Archived', archivedAt: '2026-01-01T00:00:00.000Z' }),
  ]

  it('orders suggested → favorites → recent → frequent → all', () => {
    const ranked = rankCategoriesForPicker({
      categories,
      suggestedCategoryId: 'cat-c',
      recentTransactions: [
        makeExpense({
          id: 'tx-1',
          title: 'Uber',
          accountId: 'acc-1',
          categoryId: 'cat-b',
          originalAmountMinor: 1000,
          date: '2026-07-20',
        }),
      ],
      suggestions: [
        makeSuggestion({
          normalizedTitle: 'rent',
          mostUsedCategoryId: 'cat-b',
          useCount: 5,
        }),
      ],
    })

    expect(ranked.map((row) => row.category.id)).toEqual(['cat-c', 'cat-a', 'cat-b'])
    expect(ranked.map((row) => row.section)).toEqual([
      'suggested',
      'favorites',
      'recent',
    ])
  })

  it('returns unique recent titles for chips', () => {
    const titles = recentTitleSuggestions(
      [
        makeSuggestion({
          normalizedTitle: 'lunch',
          originalRecentTitles: ['Lunch', 'Lunch special'],
          lastUsedAt: '2026-07-24T12:00:00.000Z',
        }),
        makeSuggestion({
          normalizedTitle: 'coffee',
          originalRecentTitles: ['Coffee'],
          lastUsedAt: '2026-07-23T12:00:00.000Z',
        }),
      ],
      3,
    )
    expect(titles).toEqual(['Lunch', 'Lunch special', 'Coffee'])
  })
})
