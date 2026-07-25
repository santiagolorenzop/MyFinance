# Currency, FX, and credit-card balances — implementation report

## Architecture summary

- **Account balances** remain native-currency only (`initialBalanceMinor` + `accountAmountMinor` movements). Exchange rate changes never rewrite balances.
- **Reporting / budgets / stats / reports** continue to use each transaction’s frozen `baseCurrencyAmountMinor`.
- **Market rates** are cached in IndexedDB table `exchangeRates` (schema v2, additive). Rate meaning: **1 base = N quote** (e.g. USD/COP = 4050).
- On save, foreign-currency entries can pass `baseQuoteRate` into `resolveConversion`, which derives `baseCurrencyAmountMinor` and stores `exchangeRate`, `exchangeRateDate`, and `exchangeRateSource` on the transaction forever.
- **Credit cards / loans** use an explicit “This amount is debt” checkbox so opening debt can be stored as a negative minor amount without relying on the iOS minus key.
- **Transfers** were already correct (linked legs, not income/expense/budget); coverage was expanded for checking → credit card payments.

## Files modified / added (high level)

| Area | Paths |
|------|--------|
| Schema / DB | `src/config/app.ts` (SCHEMA_VERSION=2), `src/db/database.ts`, `src/db/migrations.ts`, `src/domain/schemas/entities.ts`, `src/domain/types.ts` |
| FX engine | `src/services/currency/currencyService.ts`, `src/services/exchangeRate/*`, `src/repositories/exchangeRatesRepository.ts` |
| Transactions | `src/services/transaction/transactionService.ts`, expense/income screens |
| Credit debt UX | `src/components/forms/DebtAmountField.tsx`, `src/services/account/debtAmount.ts`, Accounts + Onboarding |
| Settings | `src/features/settings/CurrenciesSettingsScreen.tsx`, Preferences reportingCurrency sync |
| Backup | `src/services/backup/backupTypes.ts`, `backupRepository.ts`, `backupService.ts` |
| App init | `src/app/providers.tsx` (non-blocking rate refresh) |
| Tests | currency, FX, credit-card transfer, debt helper, accounts, backup, app config |
| Docs | `DECISIONS.md`, this file |

## Migrations

- **Dexie v1 → v2:** additive `exchangeRates` store only. Existing tables/data are preserved. No delete/recreate of the database.
- **Transaction.exchangeRateDate:** nullable with Zod default `null` so older rows/backups remain valid.
- **UserSettings.reportingCurrency:** optional; UI/reporting fall back to `baseCurrency`.
- **Backups:** `exchangeRates` included; missing in v1 backups defaults to `[]`.

## Tests added / updated

- Credit card opening balance −300; edit path covered via debt helper + repository create
- Transfer checking 1000 + CC −300 → 900 / −200; overpay → positive credit
- COP→USD conversion with frozen rate; historical amount unchanged after rate update
- Offline / failed refresh uses cache; API refresh writes cache
- Backup/restore preserves exchange rates and transaction rate fields
- SCHEMA_VERSION = 2

## Backward compatibility

- Existing IndexedDB v1 installs upgrade in place.
- Existing transactions without `exchangeRateDate` read as `null`.
- Same-currency USD flows unchanged.
- Transfers, periods, budgets, and closed reports keep prior semantics.

## Remaining limitations

- Automatic FX API is open.er-api.com (USD-based pairs). No API key; availability depends on the network.
- UI focuses on USD/COP display in Settings; other quote currencies are refreshed when active but not all shown as dedicated rows.
- `reportingCurrency` is stored but currently always mirrored to `baseCurrency` (no independent dual-currency reporting UI).
- Cross-currency transfers auto-fill destination from cached FX and allow override; pairs that are not both base-linked (e.g. EUR↔COP without rates) still need a manual destination amount.
- Expense/income edit preserves frozen FX (and recomputes from the stored rate when the amount changes); create remains the primary auto-fill UX.

## Recommendations

1. Consider a dedicated “Rates” settings page if more pairs are needed.
2. Add a small online/offline indicator near the rate field during entry.
3. Optional richer FX display on account movement lists (detail screen already shows frozen rate + reporting amount).
