import { describe, expect, it } from 'vitest'
import {
  convertQuoteToBase,
  convertViaRate,
  invertRateString,
  isMissingBaseConversion,
  resolveConversion,
} from '@/services/currency'
import { currencies } from '@/test/fixtures/engineFixtures'

describe('currencyService', () => {
  it('passes through same-currency amounts', () => {
    const result = resolveConversion({
      originalAmountMinor: 2800,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies,
    })
    expect(result.accountAmountMinor).toBe(2800)
    expect(result.baseCurrencyAmountMinor).toBe(2800)
    expect(result.status).toBe('ok')
    expect(result.usedBaseQuoteRate).toBe(false)
  })

  it('supports manual account amount conversion', () => {
    const result = resolveConversion({
      originalAmountMinor: 1000,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      accountAmountMinor: 400000,
      currencies,
    })
    expect(result.accountAmountMinor).toBe(400000)
    expect(result.baseCurrencyAmountMinor).toBe(1000)
    expect(result.exchangeRate).toBe('40000')
  })

  it('supports explicit exchange-rate conversion with half-away rounding', () => {
    expect(convertViaRate(1000, 2, 0, '4000')).toBe(40000)
    const result = resolveConversion({
      originalAmountMinor: 199,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      exchangeRate: '4000.5',
      currencies,
    })
    // 1.99 USD * 4000.5 = 7960.995 COP → 7961 (0 dp)
    expect(result.accountAmountMinor).toBe(7961)
    expect(result.baseCurrencyAmountMinor).toBe(199)
  })

  it('converts COP native amounts to USD with market baseQuoteRate', () => {
    // 100000 COP / 4050 ≈ 24.69 USD → 2469 minor
    expect(convertQuoteToBase(100_000, 0, 2, '4050')).toBe(2469)
    const result = resolveConversion({
      originalAmountMinor: 100_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4050',
      quoteCurrencyCode: 'COP',
      currencies,
    })
    expect(result.status).toBe('ok')
    expect(result.accountAmountMinor).toBe(100_000)
    expect(result.baseCurrencyAmountMinor).toBe(2469)
    expect(result.exchangeRate).toBe('4050')
    expect(result.usedBaseQuoteRate).toBe(true)
  })

  it('derives COP account amount from USD original via baseQuoteRate', () => {
    const result = resolveConversion({
      originalAmountMinor: 10_000,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4050',
      quoteCurrencyCode: 'COP',
      currencies,
    })
    expect(result.status).toBe('ok')
    expect(result.accountAmountMinor).toBe(405_000)
    expect(result.baseCurrencyAmountMinor).toBe(10_000)
  })

  it('derives USD account amount from COP original via baseQuoteRate', () => {
    const result = resolveConversion({
      originalAmountMinor: 405_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4050',
      quoteCurrencyCode: 'COP',
      currencies,
    })
    expect(result.status).toBe('ok')
    expect(result.accountAmountMinor).toBe(10_000)
    expect(result.baseCurrencyAmountMinor).toBe(10_000)
  })

  it('flags missing conversion instead of guessing', () => {
    const result = resolveConversion({
      originalAmountMinor: 1000,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'EUR',
      accountAmountMinor: 400000,
      currencies: {
        USD: currencies.USD,
        COP: currencies.COP,
        EUR: { code: 'EUR', decimalPlaces: 2 },
      },
    })
    expect(isMissingBaseConversion(result)).toBe(true)
    expect(result.baseCurrencyAmountMinor).toBeNull()
    expect(result.status).toBe('missing_base_conversion')
  })

  it('flags missing account amount when currencies differ and no rate is given', () => {
    const result = resolveConversion({
      originalAmountMinor: 1000,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      currencies,
    })
    expect(result.status).toBe('missing_account_amount')
  })

  it('inverts rates for quote→base conversion', () => {
    expect(Number(invertRateString('4050'))).toBeCloseTo(1 / 4050, 10)
  })
})
