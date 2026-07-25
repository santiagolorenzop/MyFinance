import { describe, expect, it } from 'vitest'
import { calculateAccountBalance } from '@/services/accountBalance'
import {
  createTransferLegs,
  editTransferInLedger,
  removeTransferFromLedger,
  softDeleteTransferInLedger,
  upsertTransferInLedger,
} from '@/services/transfer'
import { makeAccount, treatments } from '@/test/fixtures/engineFixtures'

describe('transferService', () => {
  const source = makeAccount({
    id: 'acc-a',
    name: 'USD Wallet',
    currencyCode: 'USD',
    initialBalanceMinor: 20000,
  })
  const dest = makeAccount({
    id: 'acc-b',
    name: 'COP Wallet',
    type: 'cash',
    currencyCode: 'COP',
    initialBalanceMinor: 0,
  })

  it('handles cross-currency transfers with distinct amounts', () => {
    const legs = createTransferLegs({
      transferId: 'xfer-fx',
      date: '2026-07-01',
      title: 'USD to COP',
      sourceAccountId: 'acc-a',
      destinationAccountId: 'acc-b',
      sourceAmountMinor: 1000,
      sourceCurrencyCode: 'USD',
      destinationAmountMinor: 400000,
      destinationCurrencyCode: 'COP',
      exchangeRate: '4000',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    const ledger = upsertTransferInLedger([], legs)
    expect(calculateAccountBalance(source, ledger, treatments).balanceMinor).toBe(19000)
    expect(calculateAccountBalance(dest, ledger, treatments).balanceMinor).toBe(400000)
  })

  it('editing a transfer updates both sides', () => {
    const draft = {
      transferId: 'xfer-edit',
      date: '2026-07-01',
      title: 'Move',
      sourceAccountId: 'acc-a',
      destinationAccountId: 'acc-b',
      sourceAmountMinor: 1000,
      sourceCurrencyCode: 'USD',
      destinationAmountMinor: 1000,
      destinationCurrencyCode: 'USD',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    }
    let ledger = upsertTransferInLedger([], createTransferLegs(draft))
    ledger = editTransferInLedger(ledger, {
      ...draft,
      sourceAmountMinor: 2500,
      destinationAmountMinor: 2500,
      updatedAt: '2026-07-02T00:00:00.000Z',
    })
    const active = ledger.filter((tx) => tx.deletedAt == null)
    expect(active).toHaveLength(2)
    expect(calculateAccountBalance(source, ledger, treatments).balanceMinor).toBe(17500)
  })

  it('deleting a transfer removes both sides', () => {
    const legs = createTransferLegs({
      transferId: 'xfer-del',
      date: '2026-07-01',
      title: 'Move',
      sourceAccountId: 'acc-a',
      destinationAccountId: 'acc-b',
      sourceAmountMinor: 1000,
      sourceCurrencyCode: 'USD',
      destinationAmountMinor: 1000,
      destinationCurrencyCode: 'USD',
      treatmentId: 'treat-transfer',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    })
    let ledger = upsertTransferInLedger([], legs)
    ledger = softDeleteTransferInLedger(ledger, 'xfer-del', '2026-07-02T00:00:00.000Z')
    expect(calculateAccountBalance(source, ledger, treatments).balanceMinor).toBe(20000)
    expect(removeTransferFromLedger(ledger, 'xfer-del')).toHaveLength(0)
  })
})
