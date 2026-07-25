import type { Transaction } from '@/domain/types'

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Export transactions as CSV. Presentation serialization only — no financial formulas.
 */
export function transactionsToCsv(transactions: Transaction[]): string {
  const headers = [
    'id',
    'date',
    'title',
    'transactionType',
    'accountId',
    'categoryId',
    'fundId',
    'treatmentId',
    'originalAmountMinor',
    'originalCurrencyCode',
    'accountAmountMinor',
    'accountCurrencyCode',
    'baseCurrencyAmountMinor',
    'notes',
    'entrySource',
    'deletedAt',
  ]

  const lines = [headers.join(',')]
  const active = [...transactions].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  )

  for (const tx of active) {
    const row = [
      tx.id,
      tx.date,
      tx.title,
      tx.transactionType,
      tx.accountId,
      tx.categoryId ?? '',
      tx.fundId ?? '',
      tx.treatmentId,
      String(tx.originalAmountMinor),
      tx.originalCurrencyCode,
      String(tx.accountAmountMinor),
      tx.accountCurrencyCode,
      tx.baseCurrencyAmountMinor == null ? '' : String(tx.baseCurrencyAmountMinor),
      tx.notes ?? '',
      tx.entrySource,
      tx.deletedAt ?? '',
    ].map((cell) => csvEscape(cell))
    lines.push(row.join(','))
  }

  return `${lines.join('\n')}\n`
}
