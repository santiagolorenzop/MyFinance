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
  /**
   * Original→account rate: 1 major original = this many major account.
   * Used when currencies differ and account amount is not supplied.
   */
  exchangeRate?: string | null
  /**
   * Market rate for reporting: 1 major base = this many major units of `quoteCurrencyCode`.
   * Used to derive baseCurrencyAmount when neither original nor account is the base currency.
   */
  baseQuoteRate?: string | null
  /** Foreign currency that `baseQuoteRate` quotes (e.g. COP when rate is USD/COP). */
  quoteCurrencyCode?: string | null
  /** Optional explicit base amount; otherwise derived when possible. */
  baseCurrencyAmountMinor?: number | null
  currencies: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>>
}

export interface ConversionResult {
  accountAmountMinor: number
  accountCurrencyCode: string
  baseCurrencyAmountMinor: number | null
  /**
   * Audit rate stored on the transaction.
   * - Same currency as base: '1'
   * - Original≠account: original→account rate
   * - Foreign native amount converted via market rate: the baseQuoteRate (1 base = N quote)
   */
  exchangeRate: string | null
  /** True when base amount came from baseQuoteRate. */
  usedBaseQuoteRate: boolean
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
 * Invert a positive decimal rate string (1/rate) with half-away-from-zero rounding.
 */
export function invertRateString(rate: string, outputDecimals = 12): string {
  const trimmed = rate.trim().replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Invalid exchange rate')
  }
  const [whole, fraction = ''] = trimmed.split('.')
  const scale = fraction.length
  const digits = BigInt(`${whole}${fraction}`)
  if (digits <= 0n) {
    throw new Error('Invalid exchange rate')
  }
  const precision = BigInt(outputDecimals)
  const numerator = 10n ** (BigInt(scale) + precision)
  const half = digits / 2n
  const rounded = (numerator + half) / digits
  const raw = rounded.toString().padStart(outputDecimals + 1, '0')
  const wholeOut = raw.slice(0, raw.length - outputDecimals) || '0'
  const fracOut = raw.slice(raw.length - outputDecimals).replace(/0+$/, '')
  return fracOut.length > 0 ? `${wholeOut}.${fracOut}` : wholeOut
}

/**
 * Convert a quote-currency amount to base using rate meaning 1 base = `rate` quote.
 */
export function convertQuoteToBase(
  quoteMinor: number,
  quoteDecimalPlaces: number,
  baseDecimalPlaces: number,
  baseQuoteRate: string,
): number {
  return convertViaRate(
    quoteMinor,
    quoteDecimalPlaces,
    baseDecimalPlaces,
    invertRateString(baseQuoteRate),
  )
}

/**
 * Convert a base-currency amount to quote using rate meaning 1 base = `rate` quote.
 */
export function convertBaseToQuote(
  baseMinor: number,
  baseDecimalPlaces: number,
  quoteDecimalPlaces: number,
  baseQuoteRate: string,
): number {
  return convertViaRate(
    baseMinor,
    baseDecimalPlaces,
    quoteDecimalPlaces,
    baseQuoteRate,
  )
}

/**
 * Resolve account and base amounts without guessing exchange rates.
 */
export function resolveConversion(input: ConversionInput): ConversionResult {
  const originalCurrency = requireCurrency(input.currencies, input.originalCurrencyCode)
  const accountCurrency = requireCurrency(input.currencies, input.accountCurrencyCode)
  const baseCurrency = requireCurrency(input.currencies, input.baseCurrencyCode)

  let accountAmountMinor: number
  let exchangeRate: string | null = input.exchangeRate ?? null
  let usedBaseQuoteRate = false

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
  } else if (
    input.baseQuoteRate &&
    input.quoteCurrencyCode &&
    input.originalCurrencyCode === input.baseCurrencyCode &&
    input.accountCurrencyCode === input.quoteCurrencyCode
  ) {
    // Original in base, account in quote: derive account from market rate.
    accountAmountMinor = convertBaseToQuote(
      input.originalAmountMinor,
      baseCurrency.decimalPlaces,
      accountCurrency.decimalPlaces,
      input.baseQuoteRate,
    )
    exchangeRate = input.baseQuoteRate
    usedBaseQuoteRate = true
  } else {
    return {
      accountAmountMinor: 0,
      accountCurrencyCode: input.accountCurrencyCode,
      baseCurrencyAmountMinor: null,
      exchangeRate: null,
      usedBaseQuoteRate: false,
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
  } else if (
    input.baseQuoteRate &&
    input.quoteCurrencyCode &&
    (input.accountCurrencyCode === input.quoteCurrencyCode ||
      input.originalCurrencyCode === input.quoteCurrencyCode)
  ) {
    const foreignCode =
      input.accountCurrencyCode === input.quoteCurrencyCode
        ? input.accountCurrencyCode
        : input.originalCurrencyCode
    const foreignMinor =
      foreignCode === input.accountCurrencyCode
        ? accountAmountMinor
        : input.originalAmountMinor
    const foreignCurrency = requireCurrency(input.currencies, foreignCode)
    baseCurrencyAmountMinor = convertQuoteToBase(
      foreignMinor,
      foreignCurrency.decimalPlaces,
      baseCurrency.decimalPlaces,
      input.baseQuoteRate,
    )
    exchangeRate = input.baseQuoteRate
    usedBaseQuoteRate = true
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
    usedBaseQuoteRate,
    status,
    requiresBaseConversion,
  }
}

export function isMissingBaseConversion(result: ConversionResult): boolean {
  return result.requiresBaseConversion || result.baseCurrencyAmountMinor == null
}

export function exchangeRateId(base: string, quote: string): string {
  return `${base}_${quote}`
}
