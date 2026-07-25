import { db } from '@/db'
import { exchangeRateSchema } from '@/domain/schemas'
import type { ExchangeRate } from '@/domain/types'
import { exchangeRateId } from '@/services/currency/currencyService'

export async function listExchangeRates(): Promise<ExchangeRate[]> {
  return db.exchangeRates.orderBy('updatedAt').reverse().toArray()
}

export async function getExchangeRate(
  baseCurrencyCode: string,
  quoteCurrencyCode: string,
): Promise<ExchangeRate | undefined> {
  if (baseCurrencyCode === quoteCurrencyCode) return undefined
  return db.exchangeRates.get(exchangeRateId(baseCurrencyCode, quoteCurrencyCode))
}

export async function putExchangeRate(
  input: Omit<ExchangeRate, 'id' | 'updatedAt'> & { updatedAt?: string },
): Promise<ExchangeRate> {
  const now = input.updatedAt ?? new Date().toISOString()
  const row = exchangeRateSchema.parse({
    id: exchangeRateId(input.baseCurrencyCode, input.quoteCurrencyCode),
    baseCurrencyCode: input.baseCurrencyCode,
    quoteCurrencyCode: input.quoteCurrencyCode,
    rate: input.rate.trim(),
    asOf: input.asOf,
    source: input.source,
    updatedAt: now,
  })
  await db.exchangeRates.put(row)
  return row
}

export async function clearExchangeRates(): Promise<void> {
  await db.exchangeRates.clear()
}
