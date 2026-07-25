import { describe, expect, it } from 'vitest'
import { convertBetweenAccountCurrencies } from '@/services/exchangeRate/crossCurrencyConvert'
import { currencies } from '@/test/fixtures/engineFixtures'
import type { ExchangeRate } from '@/domain/types'

const rates: ExchangeRate[] = [
  {
    id: 'USD_COP',
    baseCurrencyCode: 'USD',
    quoteCurrencyCode: 'COP',
    rate: '4050',
    asOf: '2026-07-24T12:00:00.000Z',
    source: 'api',
    updatedAt: '2026-07-24T12:00:00.000Z',
  },
]

describe('convertBetweenAccountCurrencies', () => {
  it('converts USD source to COP destination using cached rate', () => {
    const result = convertBetweenAccountCurrencies({
      fromAmountMinor: 10_000, // $100.00
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      rates,
      currencies,
    })
    expect(result).not.toBeNull()
    expect(result?.toAmountMinor).toBe(405_000) // COP has 0 decimal places
    expect(result?.exchangeRate).toBe('4050')
  })

  it('converts COP source to USD destination', () => {
    const result = convertBetweenAccountCurrencies({
      fromAmountMinor: 405_000,
      fromCurrencyCode: 'COP',
      toCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      rates,
      currencies,
    })
    expect(result).not.toBeNull()
    expect(result?.toAmountMinor).toBe(10_000)
  })

  it('returns null when rate is missing', () => {
    const result = convertBetweenAccountCurrencies({
      fromAmountMinor: 10_000,
      fromCurrencyCode: 'USD',
      toCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      rates: [],
      currencies,
    })
    expect(result).toBeNull()
  })
})
