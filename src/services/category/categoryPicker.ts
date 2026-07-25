import {
  filterCategoriesByKind,
  type AssignableCategoryKind,
} from '@/services/category/categoryKind'
import type { Category, TitleSuggestion, Transaction } from '@/domain/types'

export type CategoryPickerSection =
  | 'suggested'
  | 'favorites'
  | 'recent'
  | 'frequent'
  | 'all'

export interface RankedCategory {
  category: Category
  section: CategoryPickerSection
}

/**
 * Order active categories for expense/income pickers.
 * Suggested → favorites → recent → frequent → remaining active.
 * When `kind` is set, only that category type is considered.
 */
export function rankCategoriesForPicker(input: {
  categories: Category[]
  suggestedCategoryId: string | null
  recentTransactions: Transaction[]
  suggestions: TitleSuggestion[]
  kind?: AssignableCategoryKind
}): RankedCategory[] {
  const scoped = input.kind
    ? filterCategoriesByKind(input.categories, input.kind)
    : input.categories
  const active = scoped.filter(
    (category) => category.isActive && category.archivedAt == null,
  )
  const byId = new Map(active.map((category) => [category.id, category]))
  const seen = new Set<string>()
  const ranked: RankedCategory[] = []

  function push(id: string | null | undefined, section: CategoryPickerSection) {
    if (!id || seen.has(id)) return
    const category = byId.get(id)
    if (!category) return
    seen.add(id)
    ranked.push({ category, section })
  }

  push(input.suggestedCategoryId, 'suggested')

  for (const category of active.filter((row) => row.isFavorite)) {
    push(category.id, 'favorites')
  }

  for (const tx of input.recentTransactions) {
    push(tx.categoryId, 'recent')
  }

  const frequent = [...input.suggestions]
    .filter((row) => row.mostUsedCategoryId != null)
    .sort((a, b) => b.useCount - a.useCount)

  for (const row of frequent) {
    push(row.mostUsedCategoryId, 'frequent')
  }

  for (const category of active) {
    push(category.id, 'all')
  }

  return ranked
}

export function recentTitleSuggestions(
  suggestions: TitleSuggestion[],
  limit = 6,
): string[] {
  return [...suggestions]
    .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
    .flatMap((row) => row.originalRecentTitles)
    .filter((title, index, all) => all.indexOf(title) === index)
    .slice(0, limit)
}
