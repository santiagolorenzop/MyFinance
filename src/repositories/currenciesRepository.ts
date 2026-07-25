import { db } from '@/db'
import { currencySchema } from '@/domain/schemas'
import type { Currency } from '@/domain/types'

export async function listCurrencies(activeOnly = false): Promise<Currency[]> {
  const rows = await db.currencies.toArray()
  const filtered = activeOnly ? rows.filter((row) => row.active) : rows
  return filtered.sort((a, b) => a.code.localeCompare(b.code))
}

export async function upsertCurrency(input: {
  code: string
  displayName: string
  symbol: string
  decimalPlaces: number
  active?: boolean
}): Promise<Currency> {
  const currency = currencySchema.parse({
    code: input.code.trim().toUpperCase(),
    displayName: input.displayName.trim(),
    symbol: input.symbol.trim() || input.code.trim().toUpperCase(),
    decimalPlaces: input.decimalPlaces,
    active: input.active ?? true,
  })
  await db.currencies.put(currency)
  return currency
}

export async function setCurrencyActive(code: string, active: boolean): Promise<Currency> {
  const existing = await db.currencies.get(code)
  if (!existing) throw new Error('Currency not found')
  const next = currencySchema.parse({ ...existing, active })
  await db.currencies.put(next)
  return next
}
