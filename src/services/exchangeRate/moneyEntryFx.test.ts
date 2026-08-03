import { describe, expect, it } from 'vitest'
import {
  previewAccountAmountMinor,
  resolveAccountAmountForSave,
} from '@/services/exchangeRate/moneyEntryFx'
import { currencies } from '@/test/fixtures/engineFixtures'

describe('moneyEntryFx account amount helpers', () => {
  it('derives COP account amount from USD original via rate', () => {
    const minor = previewAccountAmountMinor({
      originalAmountMinor: 10_000, // $100
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4050',
      quoteCurrencyCode: 'COP',
      currencies,
    })
    expect(minor).toBe(405_000)
  })

  it('derives USD account amount from COP original via rate', () => {
    const minor = previewAccountAmountMinor({
      originalAmountMinor: 405_000,
      originalCurrencyCode: 'COP',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4050',
      quoteCurrencyCode: 'COP',
      currencies,
    })
    expect(minor).toBe(10_000)
  })

  it('saves without typed account amount when rate can derive it', () => {
    const resolved = resolveAccountAmountForSave({
      needsAccountAmount: true,
      typedAccountAmountMinor: null,
      originalAmountMinor: 10_000,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4050',
      quoteCurrencyCode: 'COP',
      currencies,
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.accountAmountMinor).toBe(405_000)
  })

  it('prefers typed account amount over derived', () => {
    const resolved = resolveAccountAmountForSave({
      needsAccountAmount: true,
      typedAccountAmountMinor: 400_000,
      originalAmountMinor: 10_000,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'COP',
      baseCurrencyCode: 'USD',
      baseQuoteRate: '4050',
      quoteCurrencyCode: 'COP',
      currencies,
    })
    expect(resolved.ok).toBe(true)
    if (!resolved.ok) return
    expect(resolved.accountAmountMinor).toBe(400_000)
  })
})
