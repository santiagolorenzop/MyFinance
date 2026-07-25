import { isOutgoingTransferLeg } from '@/services/accountBalance'
import { resolveSearchResults, searchTransactions, type SearchContext } from '@/services/search'
import type { TransactionType } from '@/domain/enums'
import type { SearchMatchedField, Transaction } from '@/domain/types'
import type { FinancialDate } from '@/utils/dates'

export interface MovementFilters {
  types: TransactionType[]
  accountIds: string[]
  categoryIds: string[]
  dateFrom: FinancialDate | null
  dateTo: FinancialDate | null
}

export const EMPTY_MOVEMENT_FILTERS: MovementFilters = {
  types: [],
  accountIds: [],
  categoryIds: [],
  dateFrom: null,
  dateTo: null,
}

export function hasActiveFilters(filters: MovementFilters): boolean {
  return (
    filters.types.length > 0 ||
    filters.accountIds.length > 0 ||
    filters.categoryIds.length > 0 ||
    filters.dateFrom != null ||
    filters.dateTo != null
  )
}

/**
 * One list row per logical movement: hide incoming transfer legs.
 */
export function toMovementListRows(transactions: Transaction[]): Transaction[] {
  return transactions.filter((tx) => {
    if (tx.deletedAt != null) return false
    if (tx.transactionType === 'transfer') {
      return isOutgoingTransferLeg(tx)
    }
    return true
  })
}

export function filterMovements(
  transactions: Transaction[],
  filters: MovementFilters,
): Transaction[] {
  return transactions.filter((tx) => {
    if (tx.deletedAt != null) return false
    if (filters.types.length > 0 && !filters.types.includes(tx.transactionType)) {
      return false
    }
    if (filters.accountIds.length > 0) {
      const matchesAccount =
        filters.accountIds.includes(tx.accountId) ||
        (tx.destinationAccountId != null &&
          filters.accountIds.includes(tx.destinationAccountId))
      if (!matchesAccount) return false
    }
    if (filters.categoryIds.length > 0) {
      if (tx.categoryId == null || !filters.categoryIds.includes(tx.categoryId)) {
        return false
      }
    }
    if (filters.dateFrom != null && tx.date < filters.dateFrom) return false
    if (filters.dateTo != null && tx.date > filters.dateTo) return false
    return true
  })
}

export function sortMovementsNewestFirst(transactions: Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    const byDate = b.date.localeCompare(a.date)
    if (byDate !== 0) return byDate
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export interface MovementListItem {
  transaction: Transaction
  matchedFields: SearchMatchedField[]
}

/**
 * Apply filters + optional universal search. Never mutates ledger data.
 */
export function queryMovements(input: {
  transactions: Transaction[]
  filters: MovementFilters
  searchQuery: string
  searchContext: Omit<SearchContext, 'transactions'>
}): MovementListItem[] {
  const rows = toMovementListRows(input.transactions)
  const filtered = filterMovements(rows, input.filters)
  const sorted = sortMovementsNewestFirst(filtered)
  const query = input.searchQuery.trim()

  if (!query) {
    return sorted.map((transaction) => ({ transaction, matchedFields: [] }))
  }

  const matches = searchTransactions(query, {
    ...input.searchContext,
    transactions: sorted,
  })
  return resolveSearchResults(matches, sorted)
}
