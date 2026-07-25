import {
  convertBaseToQuote,
  convertQuoteToBase,
} from '@/services/currency'
import type { Currency, ExchangeRate } from '@/domain/types'

export interface CrossCurrencyConversion {
  toAmountMinor: number
  /** Market rate stored as 1 base = N quote for the non-base side when possible. */
  exchangeRate: string
  quoteCurrencyCode: string
  baseCurrencyCode: string
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
 * Convert an amount between two account currencies using cached base/quote rates.
 * Rate meaning: 1 base = N quote.
 */
export function convertBetweenAccountCurrencies(input: {
  fromAmountMinor: number
  fromCurrencyCode: string
  toCurrencyCode: string
  baseCurrencyCode: string
  rates: ExchangeRate[]
  currencies: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>>
}): CrossCurrencyConversion | null {
  const {
    fromAmountMinor,
    fromCurrencyCode,
    toCurrencyCode,
    baseCurrencyCode,
    rates,
    currencies,
  } = input
  if (fromCurrencyCode === toCurrencyCode) {
    return {
      toAmountMinor: fromAmountMinor,
      exchangeRate: '1',
      quoteCurrencyCode: fromCurrencyCode,
      baseCurrencyCode,
    }
  }

  const from = currencies[fromCurrencyCode]
  const to = currencies[toCurrencyCode]
  const base = currencies[baseCurrencyCode]
  if (!from || !to || !base) return null

  if (fromCurrencyCode === baseCurrencyCode) {
    const rate = findRate(rates, baseCurrencyCode, toCurrencyCode)
    if (!rate) return null
    return {
      toAmountMinor: convertBaseToQuote(
        fromAmountMinor,
        from.decimalPlaces,
        to.decimalPlaces,
        rate.rate,
      ),
      exchangeRate: rate.rate,
      quoteCurrencyCode: toCurrencyCode,
      baseCurrencyCode,
    }
  }

  if (toCurrencyCode === baseCurrencyCode) {
    const rate = findRate(rates, baseCurrencyCode, fromCurrencyCode)
    if (!rate) return null
    return {
      toAmountMinor: convertQuoteToBase(
        fromAmountMinor,
        from.decimalPlaces,
        to.decimalPlaces,
        rate.rate,
      ),
      exchangeRate: rate.rate,
      quoteCurrencyCode: fromCurrencyCode,
      baseCurrencyCode,
    }
  }

  const fromRate = findRate(rates, baseCurrencyCode, fromCurrencyCode)
  const toRate = findRate(rates, baseCurrencyCode, toCurrencyCode)
  if (!fromRate || !toRate) return null

  const inBase = convertQuoteToBase(
    fromAmountMinor,
    from.decimalPlaces,
    base.decimalPlaces,
    fromRate.rate,
  )
  return {
    toAmountMinor: convertBaseToQuote(
      inBase,
      base.decimalPlaces,
      to.decimalPlaces,
      toRate.rate,
    ),
    exchangeRate: toRate.rate,
    quoteCurrencyCode: toCurrencyCode,
    baseCurrencyCode,
  }
}
