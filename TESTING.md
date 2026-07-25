# Testing

## Tools

- **Vitest** — unit and component tests
- **React Testing Library** — UI interaction tests
- **fake-indexeddb** — IndexedDB in Node test environment
- **Zod** — schema validation coverage

## Commands

```bash
npm test
npm run test:watch
```

## Phase 1 coverage

- i18n string resolution
- Domain schema validation (including title ≠ category shape)
- System seed data (currencies, treatments, settings)
- App config / motion constants
- App shell: onboarding → home expense amount step

## Phase 2 coverage (calculation gate)

Current suite: **59 tests** across **15 files** (includes Phase 1 shell/schema tests + Phase 2 engine tests).

Engine tests under `src/services/**/*.test.ts` cover:

| Area | Cases |
|------|--------|
| Money | parse, drift-free repeated addition |
| Period | day 1, day 16, year boundary, day 31→Feb clamp, leap year, days left |
| Balances | income, expense, negative credit card, USD/COP, transfers |
| Transfers | same/cross currency, edit both sides, delete both sides |
| Currency | same-currency, manual conversion, missing base flagged |
| Budget | include monthly / exclude excluded & transfers & future; category totals; over-budget; zero allocation; unbudgeted; plan by effective date; overlap rejection |
| Reports | historical stability after new budget version |
| Transactions / Undo | save+undo; balance & stats after undo; over-budget undo; timeout; second save replaces undo; failed save preserves draft |
| Search | title/category/account; accents/case; no mutation; match reason; archived category still findable |
| Suggestions | normalize for match only; suggest from memory |

Voice parser and backup import/export tests belong to Phases 7–8.

## Conventions

- Prefer testing pure domain functions without mounting full screens
- UI tests cover navigation and critical flows only
- Do not ship personal Excel data in fixtures—use fictional samples in `src/test/fixtures`
