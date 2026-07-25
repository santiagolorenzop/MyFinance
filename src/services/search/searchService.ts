import { searchHaystackIncludes, normalizeForSearch } from '@/utils/text'
import type {
  Account,
  Category,
  Fund,
  SearchMatch,
  SearchMatchedField,
  Transaction,
  Treatment,
} from '@/domain/types'

export interface SearchContext {
  transactions: Transaction[]
  categories: Category[]
  accounts: Account[]
  funds: Fund[]
  treatments: Treatment[]
}

const MONTH_LABELS: Record<string, number> = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  agosto: 8,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
}

function monthFromQuery(query: string): number | null {
  const key = normalizeForSearch(query)
  return MONTH_LABELS[key] ?? null
}

/**
 * Universal forgiving search. Pure — never mutates financial data.
 */
export function searchTransactions(
  query: string,
  context: SearchContext,
): SearchMatch[] {
  const trimmed = query.trim()
  if (!trimmed) return []

  const categoryById = new Map(context.categories.map((c) => [c.id, c]))
  const accountById = new Map(context.accounts.map((a) => [a.id, a]))
  const fundById = new Map(context.funds.map((f) => [f.id, f]))
  const treatmentById = new Map(context.treatments.map((t) => [t.id, t]))
  const month = monthFromQuery(trimmed)

  const results: SearchMatch[] = []

  for (const tx of context.transactions) {
    if (tx.deletedAt != null) continue
    const matchedFields: SearchMatchedField[] = []

    if (searchHaystackIncludes(tx.title, trimmed)) matchedFields.push('title')
    if (searchHaystackIncludes(tx.normalizedTitle, trimmed)) {
      matchedFields.push('normalizedTitle')
    }
    if (tx.notes && searchHaystackIncludes(tx.notes, trimmed)) matchedFields.push('notes')

    const category = tx.categoryId ? categoryById.get(tx.categoryId) : undefined
    if (category && searchHaystackIncludes(category.name, trimmed)) {
      matchedFields.push('category')
    }

    const account = accountById.get(tx.accountId)
    if (account && searchHaystackIncludes(account.name, trimmed)) {
      matchedFields.push('account')
    }

    const fund = tx.fundId ? fundById.get(tx.fundId) : undefined
    if (fund && searchHaystackIncludes(fund.name, trimmed)) {
      matchedFields.push('fund')
    }

    const treatment = treatmentById.get(tx.treatmentId)
    if (treatment && searchHaystackIncludes(treatment.displayName, trimmed)) {
      matchedFields.push('treatment')
    }

    if (
      searchHaystackIncludes(tx.originalCurrencyCode, trimmed) ||
      searchHaystackIncludes(tx.accountCurrencyCode, trimmed)
    ) {
      matchedFields.push('currency')
    }

    if (searchHaystackIncludes(tx.date, trimmed)) {
      matchedFields.push('date')
    }

    if (month != null) {
      const txMonth = Number(tx.date.slice(5, 7))
      if (txMonth === month) matchedFields.push('period')
    }

    if (matchedFields.length > 0) {
      results.push({ transactionId: tx.id, matchedFields: [...new Set(matchedFields)] })
    }
  }

  return results
}

/** Convenience: resolve matched transactions preserving original title. */
export function resolveSearchResults(
  matches: SearchMatch[],
  transactions: Transaction[],
): Array<{ transaction: Transaction; matchedFields: SearchMatchedField[] }> {
  const byId = new Map(transactions.map((tx) => [tx.id, tx]))
  return matches
    .map((match) => {
      const transaction = byId.get(match.transactionId)
      if (!transaction) return null
      return { transaction, matchedFields: match.matchedFields }
    })
    .filter((row): row is { transaction: Transaction; matchedFields: SearchMatchedField[] } =>
      row != null,
    )
}
