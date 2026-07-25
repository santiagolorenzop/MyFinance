import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { getExchangeRate, putExchangeRate } from '@/repositories/exchangeRatesRepository'
import {
  getCachedRate,
  refreshExchangeRates,
  saveManualExchangeRate,
} from '@/services/exchangeRate'
import { createExpenseTransaction } from '@/services/transaction'
import { currencies } from '@/test/fixtures/engineFixtures'

describe('exchangeRateService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  it('uses cached rate when offline refresh fails', async () => {
    await putExchangeRate({
      baseCurrencyCode: 'USD',
      quoteCurrencyCode: 'COP',
      rate: '4050',
      asOf: '2026-07-24T12:00:00.000Z',
      source: 'api',
    })

    const result = await refreshExchangeRates({
      baseCurrencyCode: 'USD',
      quoteCurrencyCodes: ['COP'],
      fetchImpl: async () => {
        throw new Error('network down')
      },
    })

    expect(result.ok).toBe(false)
    expect(result.rates[0]?.rate).toBe('4050')
    const cached = await getCachedRate('USD', 'COP')
    expect(cached?.rate).toBe('4050')
  })

  it('refreshes rates from API when online', async () => {
    const result = await refreshExchangeRates({
      baseCurrencyCode: 'USD',
      quoteCurrencyCodes: ['COP'],
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            result: 'success',
            rates: { COP: 4100 },
            time_last_update_utc: 'Thu, 24 Jul 2026 00:00:00 +0000',
          }),
          { status: 200 },
        ),
    })
    expect(result.ok).toBe(true)
    const stored = await getExchangeRate('USD', 'COP')
    expect(stored?.rate).toBe('4100')
    expect(stored?.source).toBe('api')
  })

  it('saves manual override without wiping later historical transaction rates', async () => {
    await saveManualExchangeRate({
      baseCurrencyCode: 'USD',
      quoteCurrencyCode: 'COP',
      rate: '4000',
    })

    const created = createExpenseTransaction({
      date: '2026-07-20',
      title: 'Lunch',
      accountId: '11111111-1111-4111-8111-111111111111',
      treatmentId: 'treat-monthly',
      originalAmountMinor: 100_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4000',
      quoteCurrencyCode: 'COP',
      exchangeRateDate: '2026-07-20',
      exchangeRateSource: 'manual',
      currencies,
      createdAt: '2026-07-20T12:00:00.000Z',
      updatedAt: '2026-07-20T12:00:00.000Z',
    })
    expect(created.ok).toBe(true)
    if (!created.ok) return
    expect(created.transaction.exchangeRate).toBe('4000')
    expect(created.transaction.baseCurrencyAmountMinor).toBe(2500)
    expect(created.transaction.exchangeRateDate).toBe('2026-07-20')

    await saveManualExchangeRate({
      baseCurrencyCode: 'USD',
      quoteCurrencyCode: 'COP',
      rate: '5000',
    })
    // Historical transaction keeps frozen rate/amount.
    expect(created.transaction.exchangeRate).toBe('4000')
    expect(created.transaction.baseCurrencyAmountMinor).toBe(2500)
  })
})

describe('navigator offline path', () => {
  it('returns cached rates when navigator reports offline', async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
    await putExchangeRate({
      baseCurrencyCode: 'USD',
      quoteCurrencyCode: 'COP',
      rate: '4050',
      asOf: '2026-07-24T12:00:00.000Z',
      source: 'cached',
    })

    const original = navigator.onLine
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
    try {
      const result = await refreshExchangeRates({
        baseCurrencyCode: 'USD',
        quoteCurrencyCodes: ['COP'],
        fetchImpl: vi.fn(),
      })
      expect(result.ok).toBe(false)
      expect(result.online).toBe(false)
      expect(result.rates[0]?.rate).toBe('4050')
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: original })
    }
  })
})
