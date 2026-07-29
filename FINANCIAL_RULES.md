# Financial rules

Implemented as pure services under `src/services/` (Phase 2). UI must call these services; components must not reimplement formulas.

## Money (`services/money`)

- Store amounts as **integer minor units** based on each currency’s `decimalPlaces`.
- Parse user input with `parseUserAmountInput` / `toMinorUnits` (accepts `,` or `.`).
- Arithmetic via `addMinor` / `subMinor` only — never floating-point totals.
- Reject NaN, Infinity, empty, and excess decimal places at parse boundaries.
- Cross-currency conversion uses BigInt scaling (`convertViaRate`) with half-away-from-zero rounding.
- Derived audit rates use integer/`BigInt` math (`deriveRateString`); balances never accumulate via floating point.

## Financial dates (`utils/dates`, `services/period`)

- Transaction financial dates are local calendar dates: `YYYY-MM-DD`.
- Parsed with local midnight semantics — never `toISOString().slice(0, 10)`.
- Period start day (1–31) clamps to the last valid day of shorter months.
- If today’s day ≥ clamped start day → period starts this month; else previous month.
- Period end = start + one calendar month − one day.
- **Days left** = inclusive calendar days from today through period end (includes today).

## Account balance (`services/accountBalance`)

```text
initialBalance
+ income (account amount)
− expense (account amount)
− outgoing transfer legs
+ incoming transfer legs
+ adjustments (signed account amount)
```

Only treatments with `countsAsAccountMovement` affect balances. Soft-deleted rows (`deletedAt != null`) are ignored. Negative balances are valid.

## Transfers (`services/transfer`)

- One logical `linkedTransferId` with two ledger legs.
- Outgoing leg: `destinationAccountId` set; subtracts from source.
- Incoming leg: `destinationAccountId` null; adds to destination.
- Do not count toward monthly budget.
- Create / edit / delete operate on both legs together (pure ledger transforms; persistence must wrap atomically in later phases).

## Multi-currency (`services/currency`)

- Preserve original amount + currency.
- Same currency → account amount = original.
- Otherwise require manual account amount or exchange rate — **never guess**.
- Base-currency amount required for budget inclusion; missing base → flagged (`missing_base_conversion`) and excluded from budget totals.

## Monthly spending (`services/budget`)

Sum expenses where:

- `transactionType = expense`
- `categoryId` is not null (“No category” expenses affect balances/history only)
- treatment `countsTowardMonthlyBudget = true`
- financial date inside the selected period
- `baseCurrencyAmountMinor` is present
- for the **active** period, `date <= today` (exclude future)

## Category metrics

- Spent: same filters + category
- Remaining: allocation − spent (may be negative)
- Percentage: `spent / allocation` when allocation > 0; otherwise `null`
- Allocation 0 + spending > 0 → status `unbudgeted`
- Near limit at ≥ 80% (`NEAR_BUDGET_THRESHOLD`); over budget when > 100%

## Budget versions

- Plans selected by `effectiveFrom` / `effectiveTo` covering the date (`selectBudgetPlanForDate`).
- Overlapping ranges are rejected (`assertBudgetPlansDoNotOverlap`).

## Reports (`services/report`)

- Built from transactions + budget version effective at period start.
- `snapshotData` freezes category names and amounts for closed periods.
- Custom date-range reports use the same eligibility rules without an active-period “today” filter.

## Suggestions (`services/suggestion`)

- `normalizeTitle` is for matching only — never overwrites the visible title.
- Undo reverses one usage via `reverseSuggestionUsage`.

## Undo (`services/transaction`)

- Latest saved expense only; ~5s window (`UNDO_TIMEOUT_MS`).
- Soft-deletes the transaction and reverses suggestion memory.
- A newer save replaces the undo session.

## Search (`services/search`)

- Pure, case/accent-insensitive matching across title, notes, category, account, fund, treatment, currency, date, and simple month labels.
- Never mutates financial data; returns `matchedFields` for “why matched”.
