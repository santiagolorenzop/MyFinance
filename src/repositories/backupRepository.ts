import { db } from '@/db'
import type { BackupPayload } from '@/services/backup/backupTypes'

/** Persistence-only dump of every IndexedDB table used by the app. */
export async function dumpAllTables(): Promise<BackupPayload> {
  const [
    settings,
    currencies,
    accounts,
    categories,
    funds,
    treatments,
    transactions,
    budgetPlans,
    budgetAllocations,
    periodReports,
    titleSuggestions,
    exchangeRates,
  ] = await Promise.all([
    db.settings.toArray(),
    db.currencies.toArray(),
    db.accounts.toArray(),
    db.categories.toArray(),
    db.funds.toArray(),
    db.treatments.toArray(),
    db.transactions.toArray(),
    db.budgetPlans.toArray(),
    db.budgetAllocations.toArray(),
    db.periodReports.toArray(),
    db.titleSuggestions.toArray(),
    db.exchangeRates.toArray(),
  ])

  return {
    settings,
    currencies,
    accounts,
    categories,
    funds,
    treatments,
    transactions,
    budgetPlans,
    budgetAllocations,
    periodReports,
    titleSuggestions,
    exchangeRates,
  }
}

async function clearTablesInTransaction(): Promise<void> {
  await Promise.all([
    db.settings.clear(),
    db.currencies.clear(),
    db.accounts.clear(),
    db.categories.clear(),
    db.funds.clear(),
    db.treatments.clear(),
    db.transactions.clear(),
    db.budgetPlans.clear(),
    db.budgetAllocations.clear(),
    db.periodReports.clear(),
    db.titleSuggestions.clear(),
    db.exchangeRates.clear(),
  ])
}

async function putPayloadInTransaction(payload: BackupPayload): Promise<void> {
  await Promise.all([
    payload.settings.length ? db.settings.bulkPut(payload.settings) : Promise.resolve(),
    payload.currencies.length ? db.currencies.bulkPut(payload.currencies) : Promise.resolve(),
    payload.accounts.length ? db.accounts.bulkPut(payload.accounts) : Promise.resolve(),
    payload.categories.length ? db.categories.bulkPut(payload.categories) : Promise.resolve(),
    payload.funds.length ? db.funds.bulkPut(payload.funds) : Promise.resolve(),
    payload.treatments.length ? db.treatments.bulkPut(payload.treatments) : Promise.resolve(),
    payload.transactions.length
      ? db.transactions.bulkPut(payload.transactions)
      : Promise.resolve(),
    payload.budgetPlans.length ? db.budgetPlans.bulkPut(payload.budgetPlans) : Promise.resolve(),
    payload.budgetAllocations.length
      ? db.budgetAllocations.bulkPut(payload.budgetAllocations)
      : Promise.resolve(),
    payload.periodReports.length
      ? db.periodReports.bulkPut(payload.periodReports)
      : Promise.resolve(),
    payload.titleSuggestions.length
      ? db.titleSuggestions.bulkPut(payload.titleSuggestions)
      : Promise.resolve(),
    payload.exchangeRates.length
      ? db.exchangeRates.bulkPut(payload.exchangeRates)
      : Promise.resolve(),
  ])
}

/** Clear all app tables. Caller is responsible for re-seeding system data. */
export async function clearAllTables(): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await clearTablesInTransaction()
  })
}

/** Replace-all write of a validated payload. */
export async function replaceAllTables(payload: BackupPayload): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await clearTablesInTransaction()
    await putPayloadInTransaction(payload)
  })
}

/** Merge/upsert rows by primary key without clearing existing data. */
export async function mergeAllTables(payload: BackupPayload): Promise<void> {
  await db.transaction('rw', db.tables, async () => {
    await putPayloadInTransaction(payload)
  })
}
