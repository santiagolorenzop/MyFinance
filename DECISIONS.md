# Decisions

Record architectural or product decisions not fully spelled out in the specification.

Template for new entries:

```md
## YYYY-MM-DD — Title

- **Decision:**
- **Reason:**
- **Alternatives considered:**
- **Consequences:**
- **Reversible:** yes/no
```

---

## 2026-07-24 — English-first UI with centralized i18n

- **Decision:** Ship v1 with English UI strings in `src/i18n/en.ts` accessed only via `t()`. No language selector.
- **Reason:** Product owner replaced the earlier Spanish-first decision; still require localization-ready architecture.
- **Alternatives considered:** Spanish-only catalog; bilingual toggle in v1.
- **Consequences:** All built-in copy is English. User-generated content remains as entered in any language.
- **Reversible:** yes (add catalogs + optional selector later)

## 2026-07-24 — Temporary app name MyFinance

- **Decision:** Use `APP_NAME = 'MyFinance'` as a single replace point (config, manifest, docs).
- **Reason:** Working title; must be easy to rebrand.
- **Alternatives considered:** Hardcoded strings throughout.
- **Consequences:** Rename requires updating config + PWA manifest fields + docs.
- **Reversible:** yes

## 2026-07-24 — Integer minor units for money

- **Decision:** Persist money as integer minor units per currency `decimalPlaces`.
- **Reason:** Avoid floating-point drift; matches plan and spec.
- **Alternatives considered:** decimal.js everywhere; floating numbers.
- **Consequences:** Parsing/formatting helpers required in Phase 2; schema fields named `*Minor`.
- **Reversible:** costly after data exists

## 2026-07-24 — Financial dates as YYYY-MM-DD

- **Decision:** Store financial dates as local calendar strings, separate from ISO timestamps.
- **Reason:** Prevent UTC day-shifts on iPhone.
- **Alternatives considered:** Always store timezone-aware instants for financial days.
- **Consequences:** Helpers must never use UTC date slicing for display/period math.
- **Reversible:** costly after data exists

## 2026-07-24 — Cloudflare Pages as initial host only

- **Decision:** Ship `public/_redirects` for Cloudflare Pages SPA fallback; keep app code host-agnostic.
- **Reason:** Spec requires at least one static host; plan forbids Cloudflare runtime coupling.
- **Alternatives considered:** Vercel/Netlify as initial target.
- **Consequences:** Docs describe how to move hosts; no Workers/KV/D1 usage.
- **Reversible:** yes

## 2026-07-24 — Phase 1 onboarding is a shell

- **Decision:** Phase 1 onboarding includes welcome + finish that sets `onboardingCompleted`, not full account/budget setup.
- **Reason:** Full onboarding is Phase 3; Phase 1 only validates navigation and gate.
- **Alternatives considered:** Block app until full Phase 3 forms exist.
- **Consequences:** Users can reach expense skeleton without creating accounts yet.
- **Reversible:** yes (replace with full flow in Phase 3)

## 2026-07-24 — Home route is expense amount step

- **Decision:** `/` renders the first quick-expense step immediately; `/add-expense` is an alias.
- **Reason:** Product requirement for Notes-like speed; not a dashboard.
- **Alternatives considered:** Dashboard with Add button; redirect from `/` to `/add-expense`.
- **Consequences:** Root IA is entry-first.
- **Reversible:** yes but product-breaking

## 2026-07-24 — Oxlint instead of ESLint

- **Decision:** Keep the Vite template’s Oxlint (`npm run lint`) for Phase 1.
- **Reason:** Ships with the scaffold; sufficient for foundation linting.
- **Alternatives considered:** Replace with ESLint + typescript-eslint immediately.
- **Consequences:** Lint rules differ from classic ESLint setups; can migrate later if needed.
- **Reversible:** yes

## 2026-07-24 — Placeholder PWA icons

- **Decision:** Ship solid-color PNG icons (192/512/maskable + apple-touch-icon) and a simple SVG favicon.
- **Reason:** Phase 1 needs valid installable assets; final brand art is not defined.
- **Alternatives considered:** Leave icons missing; delay PWA until design assets exist.
- **Consequences:** Installable but visually temporary; replace icons when branding is finalized.
- **Reversible:** yes

## 2026-07-24 — Transfer modeled as two linked ledger legs

- **Decision:** A transfer is two `transactionType: 'transfer'` rows sharing `linkedTransferId`. Outgoing leg has `destinationAccountId` set; incoming leg has it null.
- **Reason:** Keeps transactions as the single ledger source of truth while allowing atomic both-side updates.
- **Alternatives considered:** Single row with signed dual amounts; separate `transfers` table.
- **Consequences:** Balance and delete/edit logic must always load both legs; budget eligibility ignores transfer types.
- **Reversible:** costly after production data exists

## 2026-07-24 — Pure in-memory ledger transforms in Phase 2

- **Decision:** Phase 2 services transform arrays/objects only; Dexie writes are deferred to later phases.
- **Reason:** Keep the calculation gate UI-independent and maximally testable.
- **Alternatives considered:** Implement Dexie repositories in Phase 2.
- **Consequences:** Phase 3–5 must wrap create/edit/delete/undo in IndexedDB transactions that call these pure helpers.
- **Reversible:** yes (add adapters without changing formulas)

## 2026-07-24 — Open-ended budget plans cannot coexist with later plans

- **Decision:** `assertBudgetPlansDoNotOverlap` rejects an open-ended plan (`effectiveTo == null`) when any later plan exists.
- **Reason:** Avoid ambiguous “which plan applies?” windows.
- **Alternatives considered:** Auto-close previous plan on new plan creation only at write time.
- **Consequences:** Writers (Phase 3) should set `effectiveTo` on the previous plan when creating a new version.
- **Reversible:** yes

## 2026-07-24 — Cross-currency conversion uses convertViaRate only

- **Decision:** Account-amount conversion from an exchange rate uses `convertViaRate` (BigInt, half-away-from-zero). A separate minor×rate helper was removed as dead/incorrect for decimal-place scaling.
- **Reason:** Rate means “1 major original = N major account”; scaling must account for both currencies’ decimal places.
- **Alternatives considered:** Keep a dimensionless `multiplyMinorByRate`.
- **Consequences:** Callers must pass decimal places for both currencies.
- **Reversible:** yes

## 2026-07-24 — Phase 3 repositories wrap Dexie; budget versions auto-close prior plan

- **Decision:** Settings CRUD goes through `src/repositories/*`. Creating a new budget plan sets the previous open-ended plan’s `effectiveTo` to the day before the new `effectiveFrom`, then calls `assertBudgetPlansDoNotOverlap`.
- **Reason:** Satisfies Phase 2 overlap rules without asking users to close plans manually during onboarding/settings.
- **Alternatives considered:** Require explicit end dates in the UI for every version.
- **Consequences:** New versions must start after the prior plan’s start; historical plans remain readable.
- **Reversible:** yes

## 2026-07-24 — Phase 4 expense persistence wraps Phase 2 engine

- **Decision:** Quick expense save/undo goes through `expenseFlowService`, which calls Phase 2 pure helpers (`createExpenseTransaction`, `applySuccessfulExpenseSave`, `undoExpense`) then writes transactions + title suggestions atomically via repositories. UI does not contain money/conversion/undo formulas.
- **Reason:** Preserve calculation-engine purity and transaction-as-source-of-truth while wiring IndexedDB.
- **Alternatives considered:** Call Dexie directly from React; duplicate create/undo logic in the screen.
- **Consequences:** Balances/stats remain derived from the ledger; failed saves keep the draft; latest-only ~5s Undo persists as soft-delete + suggestion reverse.
- **Reversible:** yes

## 2026-07-24 — Category list sorts in memory

- **Decision:** `listCategories` loads all rows and sorts by `sortOrder` in memory instead of Dexie `orderBy('sortOrder')`.
- **Reason:** Schema v1 does not index `categories.sortOrder`; `orderBy` throws at runtime.
- **Alternatives considered:** Bump schema to add the index.
- **Consequences:** Fine for expected category counts; can add an index in a later migration if needed.
- **Reversible:** yes

## 2026-07-24 — Phase 5 reuses money-entry + transfer engines

- **Decision:** Income create/edit/duplicate shares `createMoneyEntryTransaction` / `rebuildMoneyEntryTransaction` with expenses. Transfers persist both legs through `transferService` helpers via `transferFlowService`. Movements search/filter use pure `searchService` + `movementQueryService`; delete uses soft-delete (both legs for transfers).
- **Reason:** Avoid parallel financial rules while adding remaining ledger entry points.
- **Alternatives considered:** Separate income calculator; single-row transfer model.
- **Consequences:** Balances remain derived; suggestion memory updates on expense/income create/edit/delete; transfers do not use title-suggestion memory.
- **Reversible:** yes

## 2026-07-24 — Movements are tap-first (gestures deferred)

- **Decision:** Ship Movements detail/edit/duplicate/delete as visible tap actions only. No swipe gestures in Phase 5.
- **Reason:** Plan allows deferring gestures when a11y/complexity risk outweighs benefit.
- **Alternatives considered:** Swipe-to-delete/duplicate in v1.
- **Consequences:** Desktop and VoiceOver have the same labeled actions; gestures remain a later enhancement.
- **Reversible:** yes

## 2026-07-24 — Phase 6 financial views compose existing engines

- **Decision:** Balances, monthly stats, and reports UI call Phase 2 `accountBalance` / `budget` / `period` / `report` services (plus thin view composers and `reportFlowService` for persistence). No new calculation engines.
- **Reason:** Preserve transaction-as-source-of-truth and avoid duplicated formulas in React.
- **Alternatives considered:** Cached balance tables; recomputing closed reports from live budgets.
- **Consequences:** Closed reports freeze snapshots via `buildPeriodReport`; custom ranges stay live; net totals respect `includeInTotalNetBalance` and never mix currencies.
- **Reversible:** yes

## 2026-07-24 — Phase 7 voice parser behind VoiceParser interface

- **Decision:** Dictation uses a pluggable `VoiceParser` (`deterministicVoiceParser` in v1). Optional Web Speech is feature-detected only; keyboard/OS dictation into a phrase field remains primary. Parsed/voice drafts always force the confirm step and never silent-save, even when `requireConfirmationBeforeSaving` is false. Amount text stays major-unit strings until existing money helpers convert.
- **Reason:** Plan requires a replaceable parser, offline-first deterministic parsing, and explicit confirmation for voice.
- **Alternatives considered:** Always require Web Speech; auto-save high-confidence parses.
- **Consequences:** Future parsers implement the same interface; expense `entrySource` becomes `voice` for parsed saves.
- **Reversible:** yes

## 2026-07-24 — Phase 8 plain JSON BackupCodec

- **Decision:** Backups use `BackupEnvelope` + `BackupCodec` with `PlainJsonCodec` only in v1 (no encryption). Import validates envelope and full payload via Zod, shows preview/warnings, then merge (upsert) or replace. CSV export covers transactions only. Reset clears all tables then `ensureSystemData`. Last-backup reminder timestamp lives in `localStorage` (not settings schema) to avoid a migration.
- **Reason:** Plan requires encryption-ready codec stub, Zod validation, merge/replace warnings, CSV, reset, and Safari eviction reminders without claiming infallible storage.
- **Alternatives considered:** Password encryption in v1; storing last-backup on `UserSettings`.
- **Consequences:** Future codecs can replace plain without changing envelope shape; reminder is device-local.
- **Reversible:** yes

## 2026-07-24 — Account edits block unsafe historical mutations

- **Decision:** Account updates go through `planAccountUpdate` before persistence. Safe fields (name, type, includeInTotalNetBalance, active/archive, notes/icon/default) may change anytime. Currency and initial balance (including date) are blocked when the account has transactions.
- **Reason:** Changing currency or opening balance after history would silently rewrite ledger meaning.
- **Alternatives considered:** Allow currency change with a warning only; rewrite historical amounts.
- **Consequences:** Settings/Edit surfaces repository errors for blocked sensitive changes; no historical mutation path in v1.
- **Reversible:** yes

## 2026-07-24 — Persist expense/income category kinds

- **Decision:** Categories use an assignable transaction type of `expense` or `income`. Legacy `both` (and unknown) values migrate to `expense` via idempotent `migrateCategoryKinds()` on app init. Zod still accepts `both` for backup import compatibility. Expense/income pickers, ranking, and Settings lists filter by persisted kind (not UI-only).
- **Reason:** Product requires explicit separation; existing rows lack enough signal to infer income vs expense when kind was `both`.
- **Alternatives considered:** UI-only filtering; infer income from category name heuristics.
- **Consequences:** Template seeds include Salary/Freelance/Other income; onboarding budget allocations use expense categories only.
- **Reversible:** yes (schema still stores kind)

## 2026-07-24 — Automatic frozen reports for completed periods

- **Decision:** On app init, `ensureMissingClosedPeriodSnapshots()` walks completed periods from earliest activity (or the previous period) through the day before the current period and creates a closed `periodReport` when `closedAt` is missing. Existing closed snapshots are never rewritten. Manual “Close previous period” remains as a fallback.
- **Reason:** Period rollover should produce durable frozen reports without requiring a manual close each time.
- **Alternatives considered:** Close only the immediately previous period; recompute closed totals from live budgets.
- **Consequences:** Snapshots stay frozen after later budget/category edits; duplicates are avoided by the closedAt guard in `closePeriodReportFlow`.
- **Reversible:** yes

## 2026-07-24 — Mid-period budget edits update the open plan

- **Decision:** Settings → Budgets primarily edits the current open plan via `replaceAllocations` (same-day amount/category changes apply immediately to Monthly Statistics). Creating another version is optional and starts **tomorrow** so it does not collide with an open plan that already starts today.
- **Reason:** Users need to readjust category budgets within the current period without waiting for next month or hitting “version already starts on this date.”
- **Alternatives considered:** Always create a same-day new version; allow overlapping open plans.
- **Consequences:** Live stats use the updated allocations right away; closed/frozen period reports remain unchanged; historical cutovers still use versioned `effectiveFrom`/`effectiveTo`.
- **Reversible:** yes

## 2026-07-25 — Additive FX cache + frozen per-transaction rates

- **Decision:** Schema v2 adds an `exchangeRates` IndexedDB table (no wipe). Market rates mean **1 base = N quote** (e.g. USD/COP = 4050). App init refreshes rates when online; offline uses last cache. Each transaction freezes `exchangeRate`, `exchangeRateDate`, `exchangeRateSource`, and `baseCurrencyAmountMinor` at save time. Account balances stay in native currency forever.
- **Reason:** Support COP accounts and USD reporting without rewriting history when rates change.
- **Alternatives considered:** Recompute base amounts from live rates; store rates only in localStorage.
- **Consequences:** Budgets/stats/reports keep using stored `baseCurrencyAmountMinor`. `reportingCurrency` is optional and falls back to `baseCurrency`. Credit-card debt UX stores negative `initialBalanceMinor` via an explicit debt checkbox.
- **Reversible:** yes (table can be ignored; transactions remain valid)
