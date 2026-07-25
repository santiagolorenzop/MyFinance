# Phase Review

## Status
PASS

## Phase
Credit-card debt UX + multi-currency FX cache (schema v2)

## Executive Summary
- Credit cards/loans support negative opening balances via explicit “This amount is debt” UX (iOS-safe).
- Transfers verified: payment to a credit card reduces debt; excluded from income/expense/budget.
- Account balances stay native-currency; USD + COP accounts supported.
- Additive IndexedDB v2 `exchangeRates` cache; auto-refresh when online; offline uses last rate.
- Transactions freeze rate + base amount; budgets/stats/reports keep using stored base amounts.
- Settings → Currencies shows base/reporting currency, USD/COP rate, refresh, and manual override.

## Verification

npm test:
PASS (118+ tests)

npm run lint:
PASS (warnings only if any)

npm run build:
PASS

## Architecture Self-Check

- Business logic duplicated:
NO

- React contains financial rules:
NO (conversion via resolveConversion / money helpers)

- Repository contains business logic:
NO

- Obsolete implementations remaining:
NO

- Unnecessary refactors introduced:
NO

## Important Changes
- SCHEMA_VERSION 2 + `exchangeRates` table (additive).
- `resolveConversion` supports `baseQuoteRate` (1 base = N quote).
- Expense/income entry auto-fills editable FX rate + converted reporting amount.
- Backup includes exchange rates; v1 backups remain importable.

## Known Issues
- Transfer FX auto-fill not implemented (destination amount still manual when currencies differ).
- `reportingCurrency` currently mirrored to `baseCurrency`.

## Next Phase Readiness

READY

Reason:
Core FX + debt + transfer scenarios are implemented and tested without wiping user data.

## Reviewer Attention
- Create a credit card with debt checkbox = 300 → balance −300.
- Transfer 100 from checking (1000) to that card → 900 / −200.
- Create a COP expense with cached USD/COP rate; confirm base USD amount; change rate in Settings; confirm old expense unchanged.
- Turn offline / block network and confirm expense still saves using last rate note.
- Export/import backup and confirm exchange rate + transaction rate fields survive.

## Final Project Assessment

See `docs/CURRENCY_AND_FX.md` for architecture summary, migrations, limitations, and recommendations.
