import { convertQuoteToBase } from '@/services/currency'
import type { Currency, ExchangeRate } from '@/domain/types'

export interface CurrencyNetWorthPart {
  currencyCode: string
  nativeMinor: number
  /** Converted to base when rate is available (same as native when already base). */
  baseMinor: number | null
  exchangeRate: string | null
  rateAsOf: string | null
}

export interface ReportingNetWorthSummary {
  baseCurrencyCode: string
  /**
   * Approximate net worth in reporting/base currency using current cached rates.
   * Null when any non-base currency in the total is missing a rate.
   */
  totalBaseMinor: number | null
  parts: CurrencyNetWorthPart[]
  missingRateCurrencies: string[]
}

function findRate(
  rates: ExchangeRate[],
  base: string,
  quote: string,
): ExchangeRate | undefined {
  return rates.find(
    (row) => row.baseCurrencyCode === base && row.quoteCurrencyCode === quote,
  )
}

/**
 * Convert native currency totals into an approximate reporting-currency net worth
 * using the current market rate. Does not mutate account balances.
 */
export function buildReportingNetWorth(input: {
  totalsByCurrency: Record<string, number>
  baseCurrencyCode: string
  rates: ExchangeRate[]
  currencies: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>>
}): ReportingNetWorthSummary {
  const { totalsByCurrency, baseCurrencyCode, rates, currencies } = input
  const base = currencies[baseCurrencyCode]
  const parts: CurrencyNetWorthPart[] = []
  const missingRateCurrencies: string[] = []
  let totalBaseMinor = 0
  let canTotal = true

  const codes = Object.keys(totalsByCurrency).sort((a, b) => {
    if (a === baseCurrencyCode) return -1
    if (b === baseCurrencyCode) return 1
    return a.localeCompare(b)
  })

  for (const currencyCode of codes) {
    const nativeMinor = totalsByCurrency[currencyCode] ?? 0
    if (currencyCode === baseCurrencyCode) {
      parts.push({
        currencyCode,
        nativeMinor,
        baseMinor: nativeMinor,
        exchangeRate: '1',
        rateAsOf: null,
      })
      totalBaseMinor += nativeMinor
      continue
    }

    const currency = currencies[currencyCode]
    const rateRow = findRate(rates, baseCurrencyCode, currencyCode)
    if (!currency || !base || !rateRow) {
      parts.push({
        currencyCode,
        nativeMinor,
        baseMinor: null,
        exchangeRate: null,
        rateAsOf: null,
      })
      missingRateCurrencies.push(currencyCode)
      canTotal = false
      continue
    }

    const baseMinor = convertQuoteToBase(
      nativeMinor,
      currency.decimalPlaces,
      base.decimalPlaces,
      rateRow.rate,
    )
    parts.push({
      currencyCode,
      nativeMinor,
      baseMinor,
      exchangeRate: rateRow.rate,
      rateAsOf: rateRow.asOf,
    })
    totalBaseMinor += baseMinor
  }

  return {
    baseCurrencyCode,
    totalBaseMinor: canTotal ? totalBaseMinor : null,
    parts,
    missingRateCurrencies,
  }
}
