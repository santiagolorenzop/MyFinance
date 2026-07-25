import { describe, expect, it } from 'vitest'
import { buildReportingNetWorth } from '@/services/accountBalance/reportingNetWorth'
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

describe('buildReportingNetWorth', () => {
  it('keeps native COP total and converts only the USD summary', () => {
    const summary = buildReportingNetWorth({
      totalsByCurrency: { USD: 120_000, COP: 4_050_000 },
      baseCurrencyCode: 'USD',
      rates,
      currencies,
    })

    expect(summary.parts.find((p) => p.currencyCode === 'COP')?.nativeMinor).toBe(
      4_050_000,
    )
    expect(summary.parts.find((p) => p.currencyCode === 'USD')?.nativeMinor).toBe(
      120_000,
    )
    // 4,050,000 COP / 4050 = 1,000.00 USD → 100_000 minor
    expect(summary.parts.find((p) => p.currencyCode === 'COP')?.baseMinor).toBe(100_000)
    expect(summary.totalBaseMinor).toBe(220_000)
  })

  it('converts negative credit-card COP debt into negative USD', () => {
    const summary = buildReportingNetWorth({
      totalsByCurrency: { COP: -405_000 },
      baseCurrencyCode: 'USD',
      rates,
      currencies,
    })
    expect(summary.totalBaseMinor).toBe(-10_000)
  })

  it('returns null total when a rate is missing', () => {
    const summary = buildReportingNetWorth({
      totalsByCurrency: { USD: 1000, COP: 50_000 },
      baseCurrencyCode: 'USD',
      rates: [],
      currencies,
    })
    expect(summary.totalBaseMinor).toBeNull()
    expect(summary.missingRateCurrencies).toEqual(['COP'])
  })
})
