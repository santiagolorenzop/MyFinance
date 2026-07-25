import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, ensureSystemData } from '@/db'
import { createAccount } from '@/repositories/accountsRepository'
import { createCategory } from '@/repositories/categoriesRepository'
import { putExchangeRate } from '@/repositories/exchangeRatesRepository'
import {
  createBackupEnvelope,
  importBackupPayload,
  parseBackupText,
  resetAllLocalData,
  serializeBackupEnvelope,
} from '@/services/backup'
import { transactionsToCsv } from '@/services/backup/csvExport'
import { makeExpense } from '@/test/fixtures/engineFixtures'
import {
  clearBackupTimestamp,
  recordBackupTimestamp,
  shouldShowBackupReminder,
} from '@/services/backup/backupReminder'

describe('backupService', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
    await ensureSystemData()
    clearBackupTimestamp()
  })

  it('exports a Zod-valid plain JSON envelope and round-trips replace import', async () => {
    const account = await createAccount({
      name: 'Cash',
      type: 'cash',
      currencyCode: 'USD',
      initialBalanceMinor: 1000,
      isDefault: true,
    })
    await createCategory({ name: 'Food', kind: 'expense' })
    await putExchangeRate({
      baseCurrencyCode: 'USD',
      quoteCurrencyCode: 'COP',
      rate: '4050',
      asOf: '2026-07-24T12:00:00.000Z',
      source: 'api',
    })
    const settings = await db.settings.toCollection().first()
    const treatmentId = settings?.defaultTreatmentId
    if (!treatmentId) throw new Error('missing treatment')
    await db.transactions.add(
      makeExpense({
        id: crypto.randomUUID(),
        title: 'Coffee',
        accountId: account.id,
        originalAmountMinor: 350,
        date: '2026-07-20',
        treatmentId,
        exchangeRate: '4050',
        exchangeRateSource: 'api',
        exchangeRateDate: '2026-07-24',
      }),
    )

    const envelope = await createBackupEnvelope('2026-07-24T12:00:00.000Z')
    expect(envelope.format).toBe('myfinance-backup')
    expect(envelope.codec).toBe('plain')
    expect(envelope.payload.transactions).toHaveLength(1)

    const text = serializeBackupEnvelope(envelope)
    const parsed = await parseBackupText(text)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.preview.counts.accounts).toBeGreaterThan(0)
    expect(parsed.preview.warnings.length).toBeGreaterThan(0)

    await db.transactions.clear()
    expect(await db.transactions.count()).toBe(0)

    const imported = await importBackupPayload(parsed.payload, 'replace')
    expect(imported.ok).toBe(true)
    expect(await db.transactions.count()).toBe(1)
    expect((await db.accounts.toArray()).some((row) => row.name === 'Cash')).toBe(true)
    expect(await db.exchangeRates.count()).toBe(1)
    const restoredTx = await db.transactions.toCollection().first()
    expect(restoredTx?.exchangeRate).toBe('4050')
    expect(restoredTx?.exchangeRateDate).toBe('2026-07-24')
  })

  it('merges accounts without wiping unrelated rows', async () => {
    const local = await createAccount({
      name: 'Local Only',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 0,
    })
    const envelope = await createBackupEnvelope()
    const parsed = await parseBackupText(serializeBackupEnvelope(envelope))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return

    await createAccount({
      name: 'After Export',
      type: 'savings',
      currencyCode: 'USD',
      initialBalanceMinor: 0,
    })

    const merged = await importBackupPayload(parsed.payload, 'merge')
    expect(merged.ok).toBe(true)
    const names = (await db.accounts.toArray()).map((row) => row.name)
    expect(names).toContain('Local Only')
    expect(names).toContain('After Export')
    expect(names).toContain(
      (parsed.payload.accounts.find((row) => row.id === local.id) ?? local).name,
    )
  })

  it('resetAllLocalData clears personal data and re-seeds system rows', async () => {
    await createAccount({
      name: 'Wipe me',
      type: 'cash',
      currencyCode: 'USD',
      initialBalanceMinor: 0,
    })
    await resetAllLocalData()
    expect(await db.accounts.count()).toBe(0)
    expect(await db.treatments.count()).toBeGreaterThan(0)
    expect(await db.currencies.count()).toBeGreaterThan(0)
    const settings = await db.settings.toCollection().first()
    expect(settings?.onboardingCompleted).toBe(false)
  })

  it('builds CSV rows for transactions', () => {
    const csv = transactionsToCsv([
      makeExpense({
        id: 'tx-1',
        title: 'Lunch, "special"',
        accountId: 'acc-1',
        originalAmountMinor: 1200,
        date: '2026-07-21',
      }),
    ])
    expect(csv).toContain('id,date,title')
    expect(csv).toContain('"Lunch, ""special"""')
    expect(csv).toContain('1200')
  })

  it('shows backup reminder when never backed up or stale', () => {
    expect(shouldShowBackupReminder(new Date('2026-07-24T00:00:00.000Z'))).toBe(true)
    recordBackupTimestamp(new Date('2026-07-20T00:00:00.000Z'))
    expect(shouldShowBackupReminder(new Date('2026-07-24T00:00:00.000Z'))).toBe(false)
    expect(shouldShowBackupReminder(new Date('2026-08-10T00:00:00.000Z'))).toBe(true)
  })
})
