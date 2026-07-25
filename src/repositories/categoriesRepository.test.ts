import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import {
  createCategory,
  migrateCategoryKinds,
} from '@/repositories/categoriesRepository'
import { categorySchema } from '@/domain/schemas'

describe('categoriesRepository kind migration', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  it('migrates existing both categories to expense', async () => {
    const now = new Date().toISOString()
    await db.categories.add(
      categorySchema.parse({
        id: crypto.randomUUID(),
        name: 'Mixed',
        kind: 'both',
        parentCategoryId: null,
        icon: null,
        sortOrder: 0,
        isFavorite: false,
        isActive: true,
        colorToken: null,
        createdAt: now,
        updatedAt: now,
        archivedAt: null,
      }),
    )

    const updated = await migrateCategoryKinds()
    expect(updated).toBe(1)
    const rows = await db.categories.toArray()
    expect(rows.every((row) => row.kind === 'expense' || row.kind === 'income')).toBe(
      true,
    )
    expect(rows.find((row) => row.name === 'Mixed')?.kind).toBe('expense')
  })

  it('persists explicit income and expense kinds', async () => {
    const expense = await createCategory({ name: 'Food', kind: 'expense' })
    const income = await createCategory({ name: 'Salary', kind: 'income' })
    expect(expense.kind).toBe('expense')
    expect(income.kind).toBe('income')
  })
})
