/**
 * Dexie schema versions live in `database.ts`.
 * Document migration intent here as versions grow.
 *
 * v1 — Initial schema for Phase 1 foundation:
 * settings, currencies, accounts, categories, funds, treatments,
 * transactions, budgetPlans, budgetAllocations, periodReports, titleSuggestions.
 */
export const MIGRATION_NOTES = {
  1: 'Initial IndexedDB schema (Phase 1).',
  categoryKind:
    'Startup migrateCategoryKinds(): legacy kind "both" (and unknown) → expense. Schema still accepts "both" for backup import; assignable kinds are expense|income.',
  autoClosedReports:
    'Startup ensureMissingClosedPeriodSnapshots(): create frozen periodReports for completed periods missing closedAt; never overwrite existing closed snapshots.',
} as const
