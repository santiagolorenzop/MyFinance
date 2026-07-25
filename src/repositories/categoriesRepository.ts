import { db } from '@/db'
import { categorySchema } from '@/domain/schemas'
import type { Category } from '@/domain/types'
import { IntegrityError, categoryHasTransactions } from '@/repositories/integrity'
import {
  normalizeCategoryKind,
  type AssignableCategoryKind,
} from '@/services/category/categoryKind'

export interface CategoryInput {
  name: string
  kind: AssignableCategoryKind
  isFavorite?: boolean
}

export async function listCategories(includeArchived = false): Promise<Category[]> {
  const rows = await db.categories.toArray()
  const filtered = includeArchived ? rows : rows.filter((row) => row.archivedAt == null)
  return filtered.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const now = new Date().toISOString()
  const count = await db.categories.count()
  const category = categorySchema.parse({
    id: crypto.randomUUID(),
    name: input.name.trim(),
    kind: normalizeCategoryKind(input.kind),
    parentCategoryId: null,
    icon: null,
    sortOrder: count,
    isFavorite: input.isFavorite ?? false,
    isActive: true,
    colorToken: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
  })
  await db.categories.add(category)
  return category
}

export async function updateCategory(
  id: string,
  patch: Partial<CategoryInput> & { isActive?: boolean },
): Promise<Category> {
  const existing = await db.categories.get(id)
  if (!existing || existing.archivedAt != null) {
    throw new Error('Category not found')
  }
  const next = categorySchema.parse({
    ...existing,
    ...patch,
    name: patch.name?.trim() ?? existing.name,
    kind:
      patch.kind != null
        ? normalizeCategoryKind(patch.kind)
        : normalizeCategoryKind(existing.kind),
    updatedAt: new Date().toISOString(),
  })
  await db.categories.put(next)
  return next
}

/**
 * Migrate legacy category kinds (`both` / missing) to expense|income.
 * Idempotent — safe to run on every app start.
 */
export async function migrateCategoryKinds(): Promise<number> {
  const rows = await db.categories.toArray()
  let updated = 0
  for (const row of rows) {
    const normalized = normalizeCategoryKind(row.kind)
    if (row.kind === normalized) continue
    await db.categories.put(
      categorySchema.parse({
        ...row,
        kind: normalized,
        updatedAt: new Date().toISOString(),
      }),
    )
    updated += 1
  }
  return updated
}

export async function archiveCategory(id: string): Promise<Category> {
  const existing = await db.categories.get(id)
  if (!existing) throw new Error('Category not found')
  const now = new Date().toISOString()
  const next = categorySchema.parse({
    ...existing,
    isActive: false,
    archivedAt: now,
    updatedAt: now,
  })
  await db.categories.put(next)
  return next
}

export async function deleteCategory(id: string): Promise<void> {
  if (await categoryHasTransactions(id)) {
    throw new IntegrityError(
      'This category cannot be deleted because it has transaction history. Archive it instead.',
    )
  }
  await db.categories.delete(id)
}

/** Optional minimal starter template for onboarding (not personal data). */
export const MINIMAL_CATEGORY_TEMPLATE: Array<{
  name: string
  kind: AssignableCategoryKind
}> = [
  { name: 'Food', kind: 'expense' },
  { name: 'Groceries', kind: 'expense' },
  { name: 'Transportation', kind: 'expense' },
  { name: 'Rent', kind: 'expense' },
  { name: 'Personal', kind: 'expense' },
  { name: 'Salary', kind: 'income' },
  { name: 'Freelance', kind: 'income' },
  { name: 'Other income', kind: 'income' },
]

export async function createCategoriesFromTemplate(): Promise<Category[]> {
  const created: Category[] = []
  for (const item of MINIMAL_CATEGORY_TEMPLATE) {
    created.push(await createCategory(item))
  }
  return created
}
