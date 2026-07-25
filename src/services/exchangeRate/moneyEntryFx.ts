import {
  convertQuoteToBase,
  resolveConversion,
} from '@/services/currency'
import type { Currency, ExchangeRate } from '@/domain/types'

/**
 * Decide which quote currency needs a base market rate for this entry.
 */
export function quoteCurrencyForBaseRate(input: {
  originalCurrencyCode: string
  accountCurrencyCode: string
  baseCurrencyCode: string
}): string | null {
  const { originalCurrencyCode, accountCurrencyCode, baseCurrencyCode } = input
  if (
    originalCurrencyCode !== baseCurrencyCode &&
    accountCurrencyCode !== baseCurrencyCode
  ) {
    // Prefer account currency as the foreign side when both differ from base.
    return accountCurrencyCode !== baseCurrencyCode
      ? accountCurrencyCode
      : originalCurrencyCode
  }
  if (originalCurrencyCode !== baseCurrencyCode) return originalCurrencyCode
  if (accountCurrencyCode !== baseCurrencyCode) return accountCurrencyCode
  return null
}

export function previewBaseAmountMinor(input: {
  originalAmountMinor: number
  originalCurrencyCode: string
  accountCurrencyCode: string
  baseCurrencyCode: string
  accountAmountMinor?: number | null
  exchangeRate?: string | null
  baseQuoteRate?: string | null
  quoteCurrencyCode?: string | null
  currencies: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>>
}): number | null {
  const result = resolveConversion({
    ...input,
    baseCurrencyAmountMinor: null,
  })
  return result.baseCurrencyAmountMinor
}

export function previewFromCachedRate(input: {
  amountMinor: number
  foreignCurrencyCode: string
  baseCurrencyCode: string
  rate: ExchangeRate
  currencies: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>>
}): number | null {
  const foreign = input.currencies[input.foreignCurrencyCode]
  const base = input.currencies[input.baseCurrencyCode]
  if (!foreign || !base) return null
  if (
    input.rate.baseCurrencyCode !== input.baseCurrencyCode ||
    input.rate.quoteCurrencyCode !== input.foreignCurrencyCode
  ) {
    return null
  }
  return convertQuoteToBase(
    input.amountMinor,
    foreign.decimalPlaces,
    base.decimalPlaces,
    input.rate.rate,
  )
}
