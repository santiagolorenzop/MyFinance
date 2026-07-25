import { describe, expect, it } from 'vitest'
import { planAccountUpdate } from '@/services/account/accountUpdateService'
import { makeAccount } from '@/test/fixtures/engineFixtures'

describe('accountUpdateService', () => {
  const account = makeAccount({
    id: 'acc-1',
    name: 'Checking',
    type: 'checking',
    currencyCode: 'USD',
    initialBalanceMinor: 1000,
  })

  it('allows safe field edits when history exists', () => {
    const decision = planAccountUpdate({
      existing: account,
      hasTransactions: true,
      patch: {
        name: 'Everyday checking',
        type: 'debit',
        includeInTotalNetBalance: false,
        isActive: true,
      },
    })
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.patch.name).toBe('Everyday checking')
    expect(decision.patch.type).toBe('debit')
    expect(decision.patch.includeInTotalNetBalance).toBe(false)
  })

  it('blocks currency change when transactions exist', () => {
    const decision = planAccountUpdate({
      existing: account,
      hasTransactions: true,
      patch: { currencyCode: 'EUR' },
    })
    expect(decision.ok).toBe(false)
    if (decision.ok) return
    expect(decision.code).toBe('currency_blocked')
  })

  it('blocks initial balance change when transactions exist', () => {
    const decision = planAccountUpdate({
      existing: account,
      hasTransactions: true,
      patch: { initialBalanceMinor: 5000 },
    })
    expect(decision.ok).toBe(false)
    if (decision.ok) return
    expect(decision.code).toBe('initial_balance_blocked')
  })

  it('allows currency/initial balance change with no history', () => {
    const decision = planAccountUpdate({
      existing: account,
      hasTransactions: false,
      patch: { currencyCode: 'EUR', initialBalanceMinor: 2500 },
    })
    expect(decision.ok).toBe(true)
  })
})
