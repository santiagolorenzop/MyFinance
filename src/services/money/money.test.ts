import { describe, expect, it } from 'vitest'
import {
  addMinor,
  deriveRateString,
  fromMinorUnits,
  parseUserAmountInput,
  toMinorUnits,
} from '@/services/money'

describe('money', () => {
  it('converts major units to minor units without float drift', () => {
    expect(toMinorUnits('10.50', 2)).toBe(1050)
    expect(toMinorUnits('0.1', 2)).toBe(10)
    expect(toMinorUnits(1000, 0)).toBe(1000)
  })

  it('parses comma and period decimal input', () => {
    expect(parseUserAmountInput('28,50', 2)).toBe(2850)
    expect(parseUserAmountInput('28.50', 2)).toBe(2850)
  })

  it('rejects invalid amounts', () => {
    expect(() => toMinorUnits('', 2)).toThrow()
    expect(() => toMinorUnits('abc', 2)).toThrow()
    expect(() => toMinorUnits('1.234', 2)).toThrow()
  })

  it('has no floating-point drift across repeated additions', () => {
    let total = 0
    for (let i = 0; i < 1000; i += 1) {
      total = addMinor(total, toMinorUnits('0.10', 2))
    }
    expect(total).toBe(10000)
    expect(fromMinorUnits(total, 2)).toBe('100.00')
  })

  it('derives exchange-rate audit strings with integer math', () => {
    // $10.00 → 400,000 COP ⇒ 40,000 COP per 1 USD
    expect(deriveRateString(1000, 400000, 2, 0)).toBe('40000')
    // $2.00 → $5.00 ⇒ rate 2.5
    expect(deriveRateString(200, 500, 2, 2)).toBe('2.5')
  })
})
