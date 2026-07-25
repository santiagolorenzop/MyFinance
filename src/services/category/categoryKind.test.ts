import { describe, expect, it } from 'vitest'
import {
  filterCategoriesByKind,
  normalizeCategoryKind,
} from '@/services/category/categoryKind'
import { makeCategory } from '@/test/fixtures/engineFixtures'
import { rankCategoriesForPicker } from '@/services/category/categoryPicker'

describe('categoryKind', () => {
  it('migrates legacy both/unknown kinds to expense', () => {
    expect(normalizeCategoryKind('both')).toBe('expense')
    expect(normalizeCategoryKind('expense')).toBe('expense')
    expect(normalizeCategoryKind('income')).toBe('income')
    expect(normalizeCategoryKind(undefined)).toBe('expense')
  })

  it('filters expense and income categories separately', () => {
    const categories = [
      makeCategory({ id: 'e1', name: 'Food', kind: 'expense' }),
      makeCategory({ id: 'i1', name: 'Salary', kind: 'income' }),
      makeCategory({ id: 'b1', name: 'Legacy', kind: 'both' }),
    ]
    expect(filterCategoriesByKind(categories, 'expense').map((c) => c.id)).toEqual([
      'e1',
      'b1',
    ])
    expect(filterCategoriesByKind(categories, 'income').map((c) => c.id)).toEqual(['i1'])
  })

  it('ranking respects category kind', () => {
    const categories = [
      makeCategory({ id: 'e1', name: 'Food', kind: 'expense', isFavorite: true }),
      makeCategory({ id: 'i1', name: 'Salary', kind: 'income', isFavorite: true }),
    ]
    const expenseRanked = rankCategoriesForPicker({
      categories,
      suggestedCategoryId: null,
      recentTransactions: [],
      suggestions: [],
      kind: 'expense',
    })
    const incomeRanked = rankCategoriesForPicker({
      categories,
      suggestedCategoryId: null,
      recentTransactions: [],
      suggestions: [],
      kind: 'income',
    })
    expect(expenseRanked.map((row) => row.category.id)).toEqual(['e1'])
    expect(incomeRanked.map((row) => row.category.id)).toEqual(['i1'])
  })
})
