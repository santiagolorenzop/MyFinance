import { describe, expect, it } from 'vitest'
import {
  deterministicVoiceParser,
  voiceParseRequiresConfirmation,
} from '@/services/voiceParser'
import type { VoiceParseContext } from '@/services/voiceParser'

const context: VoiceParseContext = {
  today: '2026-07-24',
  defaultCurrencyCode: 'USD',
  accounts: [
    { id: 'acc-cash', name: 'Cash' },
    { id: 'acc-checking', name: 'Main Checking' },
  ],
  currencies: [
    { code: 'USD', symbol: '$' },
    { code: 'EUR', symbol: '€' },
    { code: 'COP', symbol: '$' },
  ],
}

describe('DeterministicVoiceParser', () => {
  it('parses amount, currency, account, yesterday, and title', () => {
    const result = deterministicVoiceParser.parse(
      '25.50 USD lunch on Main Checking yesterday',
      context,
    )

    expect(result.amountText).toBe('25.50')
    expect(result.currencyCode).toBe('USD')
    expect(result.accountId).toBe('acc-checking')
    expect(result.date).toBe('2026-07-23')
    expect(result.title?.toLowerCase()).toContain('lunch')
    expect(result.confidence).toBeGreaterThan(0.7)
    expect(voiceParseRequiresConfirmation(result)).toBe(true)
  })

  it('parses today and dollar amount with default currency fallback', () => {
    const result = deterministicVoiceParser.parse('12 dollars coffee today', context)
    expect(result.amountText).toBe('12')
    expect(result.currencyCode).toBe('USD')
    expect(result.date).toBe('2026-07-24')
    expect(result.title?.toLowerCase()).toContain('coffee')
  })

  it('matches short account aliases and returns low confidence without amount', () => {
    const result = deterministicVoiceParser.parse('Cash tip', context)
    expect(result.accountId).toBe('acc-cash')
    expect(result.amountText).toBeNull()
    expect(result.confidence).toBeLessThan(0.5)
  })

  it('never silent-saves: confirmation helper is always true', () => {
    const empty = deterministicVoiceParser.parse('', context)
    expect(voiceParseRequiresConfirmation(empty)).toBe(true)
  })
})
