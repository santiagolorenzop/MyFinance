import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { createAccount } from '@/repositories/accountsRepository'
import { getTransaction } from '@/repositories/transactionsRepository'
import { calculateAccountBalance } from '@/services/accountBalance'
import { saveIncomeFlow } from '@/services/income'
import { listTreatments } from '@/repositories/treatmentsRepository'

describe('incomeFlowService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
  })

  it('persists income and increases account balance via derived ledger rules', async () => {
    const account = await createAccount({
      name: 'Checking',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 1000,
      isDefault: true,
    })
    const treatments = await listTreatments()
    const excluded = treatments.find((row) => row.behaviorKey === 'excluded')
    if (!excluded) throw new Error('missing excluded treatment')

    const now = new Date().toISOString()
    const result = await saveIncomeFlow({
      date: '2026-07-24',
      title: 'Salary',
      accountId: account.id,
      treatmentId: excluded.id,
      originalAmountMinor: 5000,
      originalCurrencyCode: 'USD',
      accountCurrencyCode: 'USD',
      baseCurrencyCode: 'USD',
      currencies: { USD: { code: 'USD', decimalPlaces: 2 } },
      createdAt: now,
      updatedAt: now,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    const stored = await getTransaction(result.transaction.id)
    expect(stored?.transactionType).toBe('income')

    const ledger = await db.transactions.toArray()
    expect(calculateAccountBalance(account, ledger, treatments).balanceMinor).toBe(6000)
  })
})
