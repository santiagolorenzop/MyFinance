# Architecture

## Overview

MyFinance is a client-only Progressive Web App. There is no backend in v1. All essential data lives in IndexedDB on the device. The service worker caches the application shell for offline use.

## Layers

```text
UI (React screens, hooks)
  → Domain services (pure calculation — Phase 2+)
  → Repositories / Dexie (persistence)
  → IndexedDB
```

### UI layer (`src/features`, `src/components`, `src/app`)

- Routes and screens
- App shell and drawer
- Centralized English strings via `t()` from `src/i18n`
- No complex financial formulas in components

### Domain layer (`src/domain`, `src/services`)

- Zod schemas and TypeScript types
- Enums / behavior keys
- **Pure calculation services (Phase 2 — complete):**
  - `money`, `period`, `accountBalance`, `currency`, `transfer`
  - `budget`, `report`, `suggestion`, `transaction`, `search`
- Services accept plain data and return new values; no React, no Dexie inside calculators
- Persistence adapters that call these services arrive in Phases 3–5
- Voice parser interface (Phase 7)

### Persistence layer (`src/db`)

- Dexie database definition and indexes
- Schema versioning / migration notes
- System seed data (currencies, treatments, default settings)

### Backup layer (Phase 8)

- Plain JSON envelope with schema validation
- `BackupCodec` interface so encryption can be added later

### Service worker / PWA

- `vite-plugin-pwa` generates the service worker and web app manifest
- Precaches shell and static assets
- Does **not** store user financial data (that stays in IndexedDB)

## Why transactions are the source of truth

Balances, budget usage, statistics, and reports are derived from:

1. Configuration (accounts, categories, budget versions, treatments, funds)
2. The transaction ledger

Account balances are not mutated as a primary write. They are calculated (Phase 2) as:

```text
initial balance
+ income
− expenses
+ incoming transfers
− outgoing transfers
+ adjustments
```

## Routing information architecture

| Route | Role |
|-------|------|
| `/onboarding` | First-run setup (full flow in Phase 3) |
| `/` | Immediate expense amount step (home) |
| `/add-expense` | Alias of `/` |
| `/transactions` | Movements |
| `/balances` | Account balances |
| `/monthly-stats` | Active period statistics |
| `/reports` | Historical periods |
| `/settings/*` | Configuration (secondary) |

## Hosting

Static Vite output only. Initial deploy target: Cloudflare Pages. The application must not depend on Cloudflare-specific runtime services.

## Phase boundaries

- **Phase 1:** Structure and UX skeletons.
- **Phase 2:** Financial calculation engine + unit tests (gate). UI still uses skeletons; expenses are not persisted through the UI yet.
- **Phase 3+:** Onboarding, settings, and data-driven screens that call the engine.
