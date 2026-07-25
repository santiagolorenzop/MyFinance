import type { TitleSuggestion, Transaction } from '@/domain/types'

/**
 * Normalize a title for matching only. Never replaces the visible transaction title.
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export interface FieldSuggestion {
  categoryId: string | null
  accountId: string | null
  fundId: string | null
  treatmentId: string | null
  confidence: number
  matchedNormalizedTitle: string | null
}

export function suggestFromMemory(
  title: string,
  memory: TitleSuggestion[],
): FieldSuggestion {
  const normalized = normalizeTitle(title)
  if (!normalized) {
    return {
      categoryId: null,
      accountId: null,
      fundId: null,
      treatmentId: null,
      confidence: 0,
      matchedNormalizedTitle: null,
    }
  }

  const exact = memory.find((row) => row.normalizedTitle === normalized)
  if (exact) {
    return {
      categoryId: exact.mostUsedCategoryId,
      accountId: exact.mostUsedAccountId,
      fundId: exact.mostUsedFundId,
      treatmentId: exact.mostUsedTreatmentId,
      confidence: Math.min(1, 0.5 + exact.useCount * 0.05),
      matchedNormalizedTitle: exact.normalizedTitle,
    }
  }

  const prefix = memory
    .filter(
      (row) =>
        row.normalizedTitle.startsWith(normalized) ||
        normalized.startsWith(row.normalizedTitle),
    )
    .sort((a, b) => b.useCount - a.useCount || b.lastUsedAt.localeCompare(a.lastUsedAt))[0]

  if (prefix) {
    return {
      categoryId: prefix.mostUsedCategoryId,
      accountId: prefix.mostUsedAccountId,
      fundId: prefix.mostUsedFundId,
      treatmentId: prefix.mostUsedTreatmentId,
      confidence: Math.min(0.7, 0.3 + prefix.useCount * 0.03),
      matchedNormalizedTitle: prefix.normalizedTitle,
    }
  }

  return {
    categoryId: null,
    accountId: null,
    fundId: null,
    treatmentId: null,
    confidence: 0,
    matchedNormalizedTitle: null,
  }
}

export function recordSuggestionUsage(
  memory: TitleSuggestion[],
  tx: Pick<
    Transaction,
    | 'title'
    | 'normalizedTitle'
    | 'categoryId'
    | 'accountId'
    | 'fundId'
    | 'treatmentId'
  >,
  usedAt: string,
): TitleSuggestion[] {
  const key = tx.normalizedTitle || normalizeTitle(tx.title)
  if (!key) return memory

  const existing = memory.find((row) => row.normalizedTitle === key)
  if (!existing) {
    return [
      ...memory,
      {
        normalizedTitle: key,
        originalRecentTitles: [tx.title],
        mostUsedCategoryId: tx.categoryId,
        mostUsedAccountId: tx.accountId,
        mostUsedFundId: tx.fundId,
        mostUsedTreatmentId: tx.treatmentId,
        useCount: 1,
        lastUsedAt: usedAt,
      },
    ]
  }

  const titles = [tx.title, ...existing.originalRecentTitles.filter((t) => t !== tx.title)].slice(
    0,
    5,
  )

  return memory.map((row) =>
    row.normalizedTitle === key
      ? {
          ...row,
          originalRecentTitles: titles,
          mostUsedCategoryId: tx.categoryId ?? row.mostUsedCategoryId,
          mostUsedAccountId: tx.accountId ?? row.mostUsedAccountId,
          mostUsedFundId: tx.fundId ?? row.mostUsedFundId,
          mostUsedTreatmentId: tx.treatmentId ?? row.mostUsedTreatmentId,
          useCount: row.useCount + 1,
          lastUsedAt: usedAt,
        }
      : row,
  )
}

/**
 * Reverse one usage event for undo. Decrements useCount; removes row at 0.
 */
export function reverseSuggestionUsage(
  memory: TitleSuggestion[],
  normalizedTitle: string,
  originalTitle: string,
): TitleSuggestion[] {
  const key = normalizedTitle || normalizeTitle(originalTitle)
  return memory
    .map((row) => {
      if (row.normalizedTitle !== key) return row
      const useCount = Math.max(0, row.useCount - 1)
      return {
        ...row,
        useCount,
        originalRecentTitles: row.originalRecentTitles.filter((t) => t !== originalTitle),
      }
    })
    .filter((row) => row.useCount > 0)
}
