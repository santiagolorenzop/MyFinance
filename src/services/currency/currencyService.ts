import { deriveRateString } from '@/services/money'
import type { Currency } from '@/domain/types'

export type ConversionStatus = 'ok' | 'missing_base_conversion' | 'missing_account_amount'

export interface ConversionInput {
  originalAmountMinor: number
  originalCurrencyCode: string
  accountCurrencyCode: string
  baseCurrencyCode: string
  /** Required when original currency ≠ account currency, unless exchangeRate is provided. */
  accountAmountMinor?: number | null
  /** 1 major unit of original currency = this many major units of account currency. */
  exchangeRate?: string | null
  /** Optional explicit base amount; otherwise derived when possible. */
  baseCurrencyAmountMinor?: number | null
  currencies: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>>
}

export interface ConversionResult {
  accountAmountMinor: number
  accountCurrencyCode: string
  baseCurrencyAmountMinor: number | null
  exchangeRate: string | null
  status: ConversionStatus
  requiresBaseConversion: boolean
}

function requireCurrency(
  currencies: ConversionInput['currencies'],
  code: string,
): Pick<Currency, 'code' | 'decimalPlaces'> {
  const currency = currencies[code]
  if (!currency) {
    throw new Error(`Unknown currency: ${code}`)
  }
  return currency
}

/**
 * Convert minor units of currency A to minor units of currency B using a rate
 * meaning: 1 major unit of A = `rate` major units of B.
 */
export function convertViaRate(
  fromMinor: number,
  fromDecimalPlaces: number,
  toDecimalPlaces: number,
  rate: string,
): number {
  const trimmed = rate.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid exchange rate')
  }

  const [whole, fraction = ''] = trimmed.split('.')
  const rateScale = fraction.length
  const rateDigits = BigInt(`${whole}${fraction}`)
  if (rateDigits <= 0n) {
    throw new Error('Invalid exchange rate')
  }

  const numerator =
    BigInt(fromMinor) * rateDigits * 10n ** BigInt(toDecimalPlaces)
  const denominator = 10n ** BigInt(fromDecimalPlaces + rateScale)
  const half = denominator / 2n
  const negative = numerator < 0n
  const absNum = negative ? -numerator : numerator
  const quotient = (absNum + half) / denominator
  const result = negative ? -quotient : quotient
  return Number(result)
}

/**
 * Resolve account and base amounts without guessing exchange rates.
 */
export function resolveConversion(input: ConversionInput): ConversionResult {
  const originalCurrency = requireCurrency(input.currencies, input.originalCurrencyCode)
  const accountCurrency = requireCurrency(input.currencies, input.accountCurrencyCode)
  requireCurrency(input.currencies, input.baseCurrencyCode)

  let accountAmountMinor: number
  let exchangeRate: string | null = input.exchangeRate ?? null

  if (input.originalCurrencyCode === input.accountCurrencyCode) {
    accountAmountMinor = input.originalAmountMinor
    exchangeRate = exchangeRate ?? '1'
  } else if (input.accountAmountMinor != null) {
    accountAmountMinor = input.accountAmountMinor
    if (!exchangeRate) {
      exchangeRate = deriveRateString(
        input.originalAmountMinor,
        accountAmountMinor,
        originalCurrency.decimalPlaces,
        accountCurrency.decimalPlaces,
      )
    }
  } else if (input.exchangeRate) {
    accountAmountMinor = convertViaRate(
      input.originalAmountMinor,
      originalCurrency.decimalPlaces,
      accountCurrency.decimalPlaces,
      input.exchangeRate,
    )
    exchangeRate = input.exchangeRate
  } else {
    return {
      accountAmountMinor: 0,
      accountCurrencyCode: input.accountCurrencyCode,
      baseCurrencyAmountMinor: null,
      exchangeRate: null,
      status: 'missing_account_amount',
      requiresBaseConversion: true,
    }
  }

  let baseCurrencyAmountMinor: number | null = input.baseCurrencyAmountMinor ?? null
  let status: ConversionStatus = 'ok'
  let requiresBaseConversion = false

  if (baseCurrencyAmountMinor != null) {
    // explicit base wins
  } else if (input.accountCurrencyCode === input.baseCurrencyCode) {
    baseCurrencyAmountMinor = accountAmountMinor
  } else if (input.originalCurrencyCode === input.baseCurrencyCode) {
    baseCurrencyAmountMinor = input.originalAmountMinor
  } else {
    status = 'missing_base_conversion'
    requiresBaseConversion = true
    baseCurrencyAmountMinor = null
  }

  return {
    accountAmountMinor,
    accountCurrencyCode: input.accountCurrencyCode,
    baseCurrencyAmountMinor,
    exchangeRate,
    status,
    requiresBaseConversion,
  }
}

export function isMissingBaseConversion(result: ConversionResult): boolean {
  return result.requiresBaseConversion || result.baseCurrencyAmountMinor == null
}
