import type { CategoryKind } from '@/domain/enums'
import type { Category } from '@/domain/types'

/** Assignable category types for expense/income flows (excludes legacy `both`). */
export const ASSIGNABLE_CATEGORY_KINDS = ['expense', 'income'] as const
export type AssignableCategoryKind = (typeof ASSIGNABLE_CATEGORY_KINDS)[number]

export function isAssignableCategoryKind(kind: string): kind is AssignableCategoryKind {
  return kind === 'expense' || kind === 'income'
}

/**
 * Normalize persisted kind for expense/income separation.
 * Legacy `both` becomes expense (safe default when ambiguous).
 */
export function normalizeCategoryKind(kind: CategoryKind | string | null | undefined): AssignableCategoryKind {
  if (kind === 'income') return 'income'
  return 'expense'
}

export function categoryMatchesKind(
  category: Pick<Category, 'kind'>,
  kind: AssignableCategoryKind,
): boolean {
  return normalizeCategoryKind(category.kind) === kind
}

export function filterCategoriesByKind(
  categories: Category[],
  kind: AssignableCategoryKind,
): Category[] {
  return categories.filter((category) => categoryMatchesKind(category, kind))
}
