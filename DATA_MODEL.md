# Data model

All IDs for user entities are UUIDs. Money is stored as **integer minor units** (never floating-point totals). Financial dates are local `YYYY-MM-DD` strings. Timestamps (`createdAt`, `updatedAt`) are ISO-8601 strings.

Schema version: **1** (Phase 1). Database name: `myfinance`.

## Entities

### UserSettings

Single row (`id = "default"`). Includes preferred language (`en` in v1), base currency, locale, financial period start day, defaults, feature flags, theme preference, `onboardingCompleted`, timestamps, `schemaVersion`.

### Currency

`code`, `displayName`, `symbol`, `decimalPlaces`, `active`.

### Account

Name, type, currency, `initialBalanceMinor`, `initialBalanceDate`, icon, sort order, default/active flags, `includeInTotalNetBalance`, notes, archive timestamp.

### Category

Name, kind (`expense` | `income` | `both`), optional parent, icon, sort order, favorite/active, `colorToken`, archive timestamp.

### Fund

Name, description, optional target amount/currency, default/active, archive timestamp.

### Treatment

Stable `behaviorKey` (`monthly_budget`, `excluded`, `first_month_extra`, `internal_transfer`), English `displayName`, flags for budget counting / account movement / transfer behavior, `isSystem`.

### Transaction

Source of truth for movements. Includes independent `title` and optional `categoryId`, amounts in minor units (original, account, optional base), FX metadata, transfer linkage, soft-delete via `deletedAt`.

### BudgetPlan

Versioned by `effectiveFrom` / optional `effectiveTo`. Base currency; optional period start day override.

### BudgetAllocation

Per-plan category allocation (`allocatedAmountMinor`).

### PeriodReport

Period bounds, totals, optional `closedAt`, `snapshotData` category rows for historical stability.

### TitleSuggestion

Local learning memory keyed by `normalizedTitle` (matching only — never replaces visible titles).

## Relations (conceptual)

```text
Account 1—* Transaction
Category 1—* Transaction
Fund 1—* Transaction
Treatment 1—* Transaction
BudgetPlan 1—* BudgetAllocation *—1 Category
BudgetPlan 1—* PeriodReport (optional)
```

Archived accounts/categories remain attached to historical transactions but are hidden from default pickers (Phase 3+).

## Zod source of truth

Schemas live in `src/domain/schemas`. Types are inferred in `src/domain/types.ts`.
