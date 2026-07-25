import type { Currency } from '@/domain/types'

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

export function assertFiniteInteger(value: number, label = 'amount'): number {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new MoneyError(`Invalid ${label}: must be a finite integer minor unit`)
  }
  return value
}

export function addMinor(a: number, b: number): number {
  return assertFiniteInteger(a) + assertFiniteInteger(b)
}

export function subMinor(a: number, b: number): number {
  return assertFiniteInteger(a) - assertFiniteInteger(b)
}

export function negateMinor(value: number): number {
  return -assertFiniteInteger(value)
}

export function compareMinor(a: number, b: number): number {
  const left = assertFiniteInteger(a)
  const right = assertFiniteInteger(b)
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/**
 * Convert a major-unit decimal string/number into minor units.
 * Uses string scaling to avoid float drift.
 */
export function toMinorUnits(
  majorInput: string | number,
  decimalPlaces: number,
): number {
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 6) {
    throw new MoneyError('Invalid decimalPlaces')
  }

  const raw =
    typeof majorInput === 'number' ? String(majorInput) : majorInput.trim()

  if (raw === '' || raw === '.' || raw === ',' || raw === '-' || raw === '-.' || raw === '-,' ) {
    throw new MoneyError('Empty amount')
  }

  const normalized = raw.replace(',', '.')
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    throw new MoneyError('Invalid amount format')
  }

  const negative = normalized.startsWith('-')
  const unsigned = negative ? normalized.slice(1) : normalized
  const [wholePart, fractionPart = ''] = unsigned.split('.')

  if (fractionPart.length > decimalPlaces) {
    throw new MoneyError(`Too many decimal places (max ${decimalPlaces})`)
  }

  const paddedFraction = fractionPart.padEnd(decimalPlaces, '0')
  const digits = `${wholePart}${paddedFraction}`.replace(/^0+(?=\d)/, '') || '0'
  const minor = Number.parseInt(digits, 10)
  if (!Number.isSafeInteger(minor)) {
    throw new MoneyError('Amount is too large')
  }
  return negative ? -minor : minor
}

/**
 * Format minor units as a major-unit string (no currency symbol).
 */
export function fromMinorUnits(minorUnits: number, decimalPlaces: number): string {
  const value = assertFiniteInteger(minorUnits)
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0) {
    throw new MoneyError('Invalid decimalPlaces')
  }

  const negative = value < 0
  const abs = Math.abs(value)
  if (decimalPlaces === 0) {
    return `${negative ? '-' : ''}${abs}`
  }

  const scale = 10 ** decimalPlaces
  const whole = Math.floor(abs / scale)
  const fraction = String(abs % scale).padStart(decimalPlaces, '0')
  return `${negative ? '-' : ''}${whole}.${fraction}`
}

export function formatMoney(
  minorUnits: number,
  currency: Pick<Currency, 'code' | 'decimalPlaces'>,
  locale = 'en-US',
): string {
  const major = Number(fromMinorUnits(minorUnits, currency.decimalPlaces))
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.code,
    minimumFractionDigits: currency.decimalPlaces,
    maximumFractionDigits: currency.decimalPlaces,
  }).format(major)
}

/**
 * Parse a positive amount from user input. Returns null when empty/invalid/non-positive.
 * Presentation helpers call this; financial rules remain in transaction services.
 */
export function tryParsePositiveAmount(
  input: string,
  decimalPlaces: number,
): number | null {
  try {
    const minor = parseUserAmountInput(input, decimalPlaces)
    return minor > 0 ? minor : null
  } catch {
    return null
  }
}

/**
 * Parse user amount input. Accepts "," or "." as decimal separator.
 */
export function parseUserAmountInput(
  input: string,
  decimalPlaces: number,
): number {
  const trimmed = input.trim()
  if (trimmed === '') {
    throw new MoneyError('Empty amount')
  }

  const commaCount = (trimmed.match(/,/g) ?? []).length
  const dotCount = (trimmed.match(/\./g) ?? []).length

  let normalized = trimmed
  if (commaCount > 0 && dotCount > 0) {
    // Assume the last separator is the decimal separator.
    const lastComma = trimmed.lastIndexOf(',')
    const lastDot = trimmed.lastIndexOf('.')
    if (lastComma > lastDot) {
      normalized = trimmed.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = trimmed.replace(/,/g, '')
    }
  } else if (commaCount > 0) {
    normalized = trimmed.replace(',', '.')
  }

  return toMinorUnits(normalized, decimalPlaces)
}

/**
 * Derive rate string meaning: 1 major unit of original = N major units of account.
 * Uses integer/BigInt arithmetic; result is an audit string, not used to re-sum balances.
 */
export function deriveRateString(
  originalMinor: number,
  accountMinor: number,
  originalDecimalPlaces: number,
  accountDecimalPlaces: number,
): string {
  const original = Math.abs(assertFiniteInteger(originalMinor))
  const account = Math.abs(assertFiniteInteger(accountMinor))
  if (original === 0) {
    throw new MoneyError('Cannot derive rate from zero original amount')
  }
  if (account === 0) {
    throw new MoneyError('Invalid derived rate')
  }

  // accountMajor / originalMajor
  // = (account / 10^accountDp) / (original / 10^originalDp)
  // = account * 10^originalDp / (original * 10^accountDp)
  let numerator = BigInt(account) * 10n ** BigInt(originalDecimalPlaces)
  let denominator = BigInt(original) * 10n ** BigInt(accountDecimalPlaces)

  const gcd = (a: bigint, b: bigint): bigint => {
    let x = a < 0n ? -a : a
    let y = b < 0n ? -b : b
    while (y !== 0n) {
      const t = y
      y = x % y
      x = t
    }
    return x
  }
  const divisor = gcd(numerator, denominator)
  numerator /= divisor
  denominator /= divisor

  // Emit up to 8 decimal places without floating-point division.
  const whole = numerator / denominator
  let remainder = numerator % denominator
  if (remainder === 0n) {
    return whole.toString()
  }

  let fraction = ''
  for (let i = 0; i < 8 && remainder !== 0n; i += 1) {
    remainder *= 10n
    const digit = remainder / denominator
    fraction += digit.toString()
    remainder %= denominator
  }
  fraction = fraction.replace(/0+$/, '')
  return fraction.length > 0 ? `${whole.toString()}.${fraction}` : whole.toString()
}
