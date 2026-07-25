# MyFinance

Offline-first personal finance Progressive Web App for iPhone. Transactions are the source of truth; balances, budgets, and reports are derived. Temporary working name: **MyFinance** (replace via `APP_NAME` in `src/config/app.ts`).

Built-in UI language for v1 is **English**. User-entered content (titles, category names, etc.) is never translated or overwritten.

## Status

**Phase 3 complete** — foundation + calculation engine + onboarding/settings CRUD.

### Phase 1
- Vite + React + TypeScript PWA shell
- IndexedDB (Dexie) schema + system seed data
- Zod domain models
- Centralized English i18n
- App shell, drawer, routes, onboarding gate
- Low-fidelity expense-entry step sequence on `/`

### Phase 2
- Pure services: money, period, account balance, currency, transfer, budget, report, suggestion, transaction (create/undo), search
- Full unit-test gate for calculation rules (see [TESTING.md](./TESTING.md) and [FINANCIAL_RULES.md](./FINANCIAL_RULES.md))
- Engine is **not** wired into polished UI yet (intentional gate)

**Not yet implemented:** real expense persistence UI (Phase 4), income/transfer/history UI (Phase 5), financial views (Phase 6), voice parser (Phase 7), backup import/export (Phase 8).

## Requirements

- Node.js 20+ recommended
- npm 10+

## Install dependencies

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`).

## Run tests

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

## Lint

```bash
npm run lint
```

## Build

```bash
npm run build
```

Produces `dist/` including the service worker (`sw.js`), web manifest, and static assets. HTTPS is required for PWA features outside localhost.

## Preview production build

```bash
npm run preview
```

## Deploy

The app is a static Vite build. Initial target: **Cloudflare Pages** (host-agnostic; no Cloudflare runtime APIs).

1. Build: `npm run build`
2. Publish the `dist/` directory over HTTPS
3. Ensure SPA fallback to `index.html` (see `public/_redirects` for Cloudflare Pages)
4. Confirm service worker scope and PWA assets load from the site root

Equivalent static hosts (Vercel, Netlify, etc.) work if SPA fallback and HTTPS are configured.

## Install on iPhone

See [IPHONE_INSTALLATION.md](./IPHONE_INSTALLATION.md). Short version:

1. Open the HTTPS site in Safari
2. Tap Share → Add to Home Screen
3. Open from the new icon (standalone)

This is **not** an App Store download.

## Documentation

| Doc | Purpose |
|-----|---------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layers and source-of-truth rules |
| [DATA_MODEL.md](./DATA_MODEL.md) | Entities and relations |
| [FINANCIAL_RULES.md](./FINANCIAL_RULES.md) | Calculation rules (implemented in Phase 2+) |
| [IPHONE_INSTALLATION.md](./IPHONE_INSTALLATION.md) | PWA install guide |
| [BACKUP_AND_RESTORE.md](./BACKUP_AND_RESTORE.md) | Backup design (Phase 8) |
| [TESTING.md](./TESTING.md) | Test strategy |
| [DECISIONS.md](./DECISIONS.md) | Architectural / product decisions |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Preview `dist/` |
| `npm test` | Vitest once |
| `npm run lint` | Oxlint on `src/` |
