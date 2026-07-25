# Financial Period — How It Works

Summary of the current implementation (read-only analysis of the codebase). Period membership is derived from transaction dates and settings; there is no stored period ID on transactions.

## 1. Is the financial period configurable?

**Yes.** It is stored on user settings as `financialPeriodStartDay` (integer **1–31**).

- Schema: `src/domain/schemas/entities.ts` (`userSettingsSchema`)
- Default seed value: `1` (`src/db/seedSystemData.ts`)

## 2. Where is it configured in the UI?

| Place | Path / screen | What you can set |
|--------|----------------|------------------|
| Onboarding | Period start-day step | Saves `financialPeriodStartDay` |
| Settings | **Settings → Period settings** (`/settings/period`) | Same field; live preview of current period |

**Available setting:** a single number — **period start day** (1–31).

The UI copy states that choosing day **16** means each period runs from the 16th through the 15th of the next month (`onboarding.periodBody` in `src/i18n/en.ts`).

**Yes — you can set the period to start on the 16th** in onboarding or Settings → Period settings.

## 3. What controls period calculation?

Not hardcoded for runtime math. Layers:

| Layer | Role |
|--------|------|
| `UserSettings.financialPeriodStartDay` | Persisted configuration |
| `src/services/period/periodService.ts` | `getPeriodForDate`, `getCurrentPeriod`, `isDateInPeriod`, `isEligibleForActiveSpent` |
| Consumers | Monthly stats, budget spent filters, report close / auto-snapshot |

Note: `BudgetPlan.financialPeriodStartDay` exists on the schema but is stored as `null` and is **not** used for period math. Only settings’ start day matters.

## 4. Start day 16 — example periods

With start day **16**, the engine produces (and tests cover):

| Example date in period | Period |
|------------------------|--------|
| 2026-07-20 | **2026-07-16 → 2026-08-15** |
| 2026-07-10 | **2026-06-16 → 2026-07-15** |
| 2026-12-20 | **2026-12-16 → 2027-01-15** |

Rules in `getPeriodForDate`:

- Start is the configured day in the appropriate month (clamped for short months, e.g. 31 in February).
- End is the day before the next period’s start (`addCalendarMonthsClamped` then minus one day).

So sequences like **Aug 16 → Sep 15** and **Sep 16 → Oct 15** follow the same logic. Tests: `src/services/period/periodService.test.ts`.

## 5. Transaction date vs entry date

**Period membership uses `transaction.date`, not created/entry time.**

There is no period foreign key on transactions. Stats and reports derive membership with `isDateInPeriod` / `isEligibleForActiveSpent` on `tx.date`.

Example: entered today (July 24) with transaction date **July 18**, and start day **16** → period **July 16 – August 15**.

If start day is still the default **1**, July 18 falls in **July 1 – July 31**.

For active monthly stats, future-dated transactions inside the current period are excluded until `today` (`isEligibleForActiveSpent`).

## 6. When the next financial period starts

Nothing is rewritten onto old transactions. Behavior is **derived**, plus **frozen report snapshots on app init**.

### Period rollover

- Current period = `getPeriodForDate(settings.financialPeriodStartDay, today)`.
- When calendar `today` moves into the next window, views recompute the new `{ start, end }`.

### Budget “reset”

- **Not** a stored reset of allocations.
- The same versioned budget plan stays in effect if `selectBudgetPlanForDate(plans, today)` still matches.
- Spent for the new period starts at **0** because only expenses with `date` in the **current** period (and ≤ today) count toward active stats.

### Monthly statistics

- Always show the **current** period for `today`.
- Prior-period spend drops out of the active view; it remains on the ledger by date.

### Report generation

- On **app initialization** (`src/app/providers.tsx`), `ensureMissingClosedPeriodSnapshots()`:
  - finds completed periods (from earliest activity through the previous period),
  - creates a **frozen** `periodReport` when `closedAt` is missing,
  - **does not** rewrite existing closed snapshots.
- Manual fallback: **Reports → Close previous period** (`closePreviousPeriodFlow`).

### Historical transactions

- Unchanged; they keep their `date`.
- Live views map that date to a period using the **current** start-day setting.
- Closed reports freeze totals/snapshots at close time and are not recomputed from later budget edits.

## 7. Gaps / caveats before relying on it “exactly as described”

The feature is largely ready for: configure start day (including 16), date-based membership, live stats for the current window, and frozen reports for completed periods.

Caveats:

1. **Auto-close is not a midnight scheduler** — snapshots run when the app initializes. If the app never opens after a rollover, reports wait until the next launch.
2. **Changing start day after history/reports exist** — closed reports keep their old `periodStart` / `periodEnd`. Later auto-walk uses the **new** start day. Mid-stream changes can make historical report boundaries diverge from a newly recomputed walk. There is no migration or warning UI for that.
3. **No separate period entity** — everything is computed from dates + settings (intentional). There is no per-transaction period stamp.
4. **Budget plan’s optional `financialPeriodStartDay`** is unused; only user settings control the calendar.

## Key files

| File | Purpose |
|------|---------|
| `src/services/period/periodService.ts` | Period math and eligibility |
| `src/services/period/periodService.test.ts` | Day 1 / day 16 / clamp / year-boundary tests |
| `src/features/settings/PeriodSettingsScreen.tsx` | Settings UI |
| `src/features/onboarding/OnboardingScreen.tsx` | Onboarding setup |
| `src/services/budget/monthlyStatsView.ts` | Current-period monthly stats |
| `src/services/report/reportFlowService.ts` | Close period + auto missing snapshots |
| `src/app/providers.tsx` | Runs auto snapshot ensure on init |
| `DECISIONS.md` | Decision: automatic frozen reports for completed periods |

## Bottom line

Setting the period to the **16th** and assigning transactions by **transaction date** is already supported and tested. Rollover zeros active spend via date filtering, keeps history on the ledger, and creates frozen reports for completed periods when the app starts (with manual close as backup).
