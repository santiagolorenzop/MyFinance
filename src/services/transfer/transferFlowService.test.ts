import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { createAccount } from '@/repositories/accountsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import { listTransactionsByTransferId } from '@/repositories/transactionsRepository'
import { calculateAccountBalance } from '@/services/accountBalance'
import { deleteTransferFlow, saveTransferFlow } from '@/services/transfer'

describe('transferFlowService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  it('persists both legs atomically and soft-deletes both on delete', async () => {
    const source = await createAccount({
      name: 'A',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 10_000,
      isDefault: true,
    })
    const dest = await createAccount({
      name: 'B',
      type: 'savings',
      currencyCode: 'USD',
      initialBalanceMinor: 0,
    })
    const treatments = await listTreatments()
    const transferTreatment = treatments.find((row) => row.behaviorKey === 'internal_transfer')
    if (!transferTreatment) throw new Error('missing transfer treatment')

    const now = new Date().toISOString()
    const saved = await saveTransferFlow({
      transferId: crypto.randomUUID(),
      date: '2026-07-24',
      title: 'Move',
      sourceAccountId: source.id,
      destinationAccountId: dest.id,
      sourceAmountMinor: 2500,
      sourceCurrencyCode: 'USD',
      destinationAmountMinor: 2500,
      destinationCurrencyCode: 'USD',
      treatmentId: transferTreatment.id,
      createdAt: now,
      updatedAt: now,
    })
    expect(saved.ok).toBe(true)
    if (!saved.ok) return

    const legs = await listTransactionsByTransferId(saved.legs.transferId)
    expect(legs).toHaveLength(2)

    let ledger = await db.transactions.toArray()
    expect(calculateAccountBalance(source, ledger, treatments).balanceMinor).toBe(7500)
    expect(calculateAccountBalance(dest, ledger, treatments).balanceMinor).toBe(2500)

    const deleted = await deleteTransferFlow(saved.legs.transferId)
    expect(deleted.ok).toBe(true)

    ledger = await db.transactions.toArray()
    expect(ledger.every((tx) => tx.deletedAt != null)).toBe(true)
    expect(calculateAccountBalance(source, ledger, treatments).balanceMinor).toBe(10_000)
    expect(calculateAccountBalance(dest, ledger, treatments).balanceMinor).toBe(0)
  })
})
