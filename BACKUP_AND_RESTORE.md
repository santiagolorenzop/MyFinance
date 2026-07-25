# Backup and restore

> Phase 8 will implement this. Phase 1 only defines the envelope shape and codec seam.

## Goals

Because there is no backend, backups are critical. Users must be able to export and import a full local dataset.

## Format (v1)

Plain JSON envelope:

```json
{
  "format": "myfinance-backup",
  "schemaVersion": 1,
  "appName": "MyFinance",
  "exportedAt": "2026-07-24T00:00:00.000Z",
  "codec": "plain",
  "payload": { }
}
```

Payload will include settings, accounts, categories, funds, treatments, transactions, budget plans/allocations, reports, and suggestion memory.

## Validation

- Zod schema validation before import
- Import preview
- Explicit confirmations for replace / merge
- Reject incompatible schema versions with a clear message

## Encryption

Not in v1. The backup service will use a `BackupCodec` interface (`PlainJsonCodec` now) so password encryption can be added later without changing the payload data model.

## CSV

Phase 8 will also support CSV export of transactions (and optionally accounts, categories, reports).

## Safety messaging

Settings will include a subtle reminder to back up periodically. The app will not claim local storage is infallible.
