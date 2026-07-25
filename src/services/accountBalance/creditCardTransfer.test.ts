import { describe, expect, it } from 'vitest'
import { calculateAccountBalance } from '@/services/accountBalance'
import { createTransferLegs } from '@/services/transfer'
import { makeAccount, treatments } from '@/test/fixtures/engineFixtures'

describe('credit card opening balances and transfers', () => {
  it('keeps credit card opening debt as -300', () => {
    const card = makeAccount({
      id: 'acc-cc',
      name: 'Credit Card',
      type: 'credit_card',
      currencyCode: 'USD',
      initialBalanceMinor: -30_000,
    })
    const balance = calculateAccountBalance(card, [], treatments)
    expect(balance.balanceMinor).toBe(-30_000)
  })

  it('transfer from checking to credit card reduces debt', () => {
    const checking = makeAccount({
      id: 'acc-check',
      name: 'Checking',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 100_000,
    })
    const card = makeAccount({
      id: 'acc-cc',
      name: 'Credit Card',
      type: 'credit_card',
      currencyCode: 'USD',
      initialBalanceMinor: -30_000,
    })

    const { outgoing, incoming } = createTransferLegs({
      transferId: 'tr-1',
      date: '2026-07-24',
      title: 'Card payment',
      sourceAccountId: checking.id,
      destinationAccountId: card.id,
      sourceAmountMinor: 10_000,
      destinationAmountMinor: 10_000,
      sourceCurrencyCode: 'USD',
      destinationCurrencyCode: 'USD',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-24T12:00:00.000Z',
      updatedAt: '2026-07-24T12:00:00.000Z',
    })

    const checkingBalance = calculateAccountBalance(
      checking,
      [outgoing, incoming],
      treatments,
    )
    const cardBalance = calculateAccountBalance(card, [outgoing, incoming], treatments)

    expect(checkingBalance.balanceMinor).toBe(90_000)
    expect(cardBalance.balanceMinor).toBe(-20_000)
  })

  it('transfer larger than debt yields a positive credit balance', () => {
    const checking = makeAccount({
      id: 'acc-check',
      name: 'Checking',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 100_000,
    })
    const card = makeAccount({
      id: 'acc-cc',
      name: 'Credit Card',
      type: 'credit_card',
      currencyCode: 'USD',
      initialBalanceMinor: -30_000,
    })

    const { outgoing, incoming } = createTransferLegs({
      transferId: 'tr-2',
      date: '2026-07-24',
      title: 'Overpay card',
      sourceAccountId: checking.id,
      destinationAccountId: card.id,
      sourceAmountMinor: 50_000,
      destinationAmountMinor: 50_000,
      sourceCurrencyCode: 'USD',
      destinationCurrencyCode: 'USD',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-24T12:00:00.000Z',
      updatedAt: '2026-07-24T12:00:00.000Z',
    })

    const cardBalance = calculateAccountBalance(card, [outgoing, incoming], treatments)
    expect(cardBalance.balanceMinor).toBe(20_000)
  })
})
