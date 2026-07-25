/**
 * Dexie schema versions live in `database.ts`.
 * Document migration intent here as versions grow.
 *
 * v1 — Initial schema for Phase 1 foundation:
 * settings, currencies, accounts, categories, funds, treatments,
 * transactions, budgetPlans, budgetAllocations, periodReports, titleSuggestions.
 *
 * v2 — Additive only (no table clears):
 * exchangeRates cache for offline FX. Existing user data is preserved.
 * Transaction.exchangeRateDate is optional/nullable for backward-compatible reads.
 */
export const MIGRATION_NOTES = {
  1: 'Initial IndexedDB schema (Phase 1).',
  2: 'Add exchangeRates table for cached USD/COP (and other) market rates. No data wipe.',
  categoryKind:
    'Startup migrateCategoryKinds(): legacy kind "both" (and unknown) → expense. Schema still accepts "both" for backup import; assignable kinds are expense|income.',
  autoClosedReports:
    'Startup ensureMissingClosedPeriodSnapshots(): create frozen periodReports for completed periods missing closedAt; never overwrite existing closed snapshots.',
} as const
