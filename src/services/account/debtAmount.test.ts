import { describe, expect, it } from 'vitest'
import { signedMinorFromDebtInput } from '@/services/account/debtAmount'
import { parseUserAmountInput } from '@/services/money'

describe('debtAmount helpers', () => {
  it('stores debt as negative without requiring a typed minus', () => {
    const minor = signedMinorFromDebtInput('300.00', 2, true, parseUserAmountInput)
    expect(minor).toBe(-30_000)
  })

  it('keeps an explicitly typed minus when debt is unchecked', () => {
    const minor = signedMinorFromDebtInput('-50', 2, false, parseUserAmountInput)
    expect(minor).toBe(-5000)
  })

  it('stores a positive credit balance when debt is unchecked', () => {
    const minor = signedMinorFromDebtInput('50.00', 2, false, parseUserAmountInput)
    expect(minor).toBe(5000)
  })
})
