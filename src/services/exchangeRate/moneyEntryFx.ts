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

/**
 * Preview the amount that will hit the account ledger.
 * When original ≠ account currency, uses baseQuoteRate if account amount is omitted.
 */
export function previewAccountAmountMinor(input: {
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
  if (result.status === 'missing_account_amount') return null
  return result.accountAmountMinor
}

/**
 * Resolve optional manual account amount for save.
 * Prefer typed account amount; otherwise let resolveConversion derive from rate.
 */
export function resolveAccountAmountForSave(input: {
  needsAccountAmount: boolean
  typedAccountAmountMinor: number | null
  originalAmountMinor: number
  originalCurrencyCode: string
  accountCurrencyCode: string
  baseCurrencyCode: string
  baseQuoteRate?: string | null
  quoteCurrencyCode?: string | null
  currencies: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>>
}): { ok: true; accountAmountMinor: number | null } | { ok: false; error: 'invalid_amount' } {
  if (!input.needsAccountAmount) {
    return { ok: true, accountAmountMinor: null }
  }
  if (input.typedAccountAmountMinor != null) {
    return { ok: true, accountAmountMinor: input.typedAccountAmountMinor }
  }
  const derived = previewAccountAmountMinor({
    originalAmountMinor: input.originalAmountMinor,
    originalCurrencyCode: input.originalCurrencyCode,
    accountCurrencyCode: input.accountCurrencyCode,
    baseCurrencyCode: input.baseCurrencyCode,
    accountAmountMinor: null,
    baseQuoteRate: input.baseQuoteRate,
    quoteCurrencyCode: input.quoteCurrencyCode,
    currencies: input.currencies,
  })
  if (derived == null) {
    return { ok: false, error: 'invalid_amount' }
  }
  return { ok: true, accountAmountMinor: derived }
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
