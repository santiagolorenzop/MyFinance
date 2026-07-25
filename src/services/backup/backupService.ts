import { APP_NAME, SCHEMA_VERSION } from '@/config/app'
import { backupEnvelopeSchema } from '@/domain/schemas'
import type { BackupEnvelope } from '@/domain/types'
import { ensureSystemData } from '@/db'
import {
  clearAllTables,
  dumpAllTables,
  mergeAllTables,
  replaceAllTables,
} from '@/repositories/backupRepository'
import { getBackupCodec, plainJsonCodec } from '@/services/backup/backupCodec'
import {
  recordBackupTimestamp,
  clearBackupTimestamp,
} from '@/services/backup/backupReminder'
import { transactionsToCsv } from '@/services/backup/csvExport'
import {
  BACKUP_TABLE_KEYS,
  backupPayloadSchema,
  type BackupImportMode,
  type BackupParseFailure,
  type BackupParseSuccess,
  type BackupPayload,
  type BackupPreview,
} from '@/services/backup/backupTypes'

function buildCounts(payload: BackupPayload): BackupPreview['counts'] {
  return {
    settings: payload.settings.length,
    currencies: payload.currencies.length,
    accounts: payload.accounts.length,
    categories: payload.categories.length,
    funds: payload.funds.length,
    treatments: payload.treatments.length,
    transactions: payload.transactions.length,
    budgetPlans: payload.budgetPlans.length,
    budgetAllocations: payload.budgetAllocations.length,
    periodReports: payload.periodReports.length,
    titleSuggestions: payload.titleSuggestions.length,
  }
}

function collectPreviewWarnings(
  envelope: BackupEnvelope,
  payload: BackupPayload,
  current: BackupPayload,
): string[] {
  const warnings: string[] = []

  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    warnings.push(
      `Backup schema version ${envelope.schemaVersion} differs from app version ${SCHEMA_VERSION}.`,
    )
  }
  if (envelope.appName !== APP_NAME) {
    warnings.push(`Backup app name "${envelope.appName}" differs from "${APP_NAME}".`)
  }
  if (envelope.codec !== 'plain') {
    warnings.push('Backup uses an unsupported codec.')
  }

  if (current.transactions.length > 0 && payload.transactions.length > 0) {
    warnings.push(
      'Replace will overwrite all current transactions. Merge will upsert matching IDs.',
    )
  }
  if (current.accounts.length > 0 && payload.accounts.length > 0) {
    const incomingIds = new Set(payload.accounts.map((row) => row.id))
    const overlap = current.accounts.filter((row) => incomingIds.has(row.id)).length
    if (overlap > 0) {
      warnings.push(
        `Merge will overwrite ${overlap} account(s) that share IDs with the backup.`,
      )
    }
  }

  if (payload.treatments.length === 0) {
    warnings.push('Backup contains no treatments. System treatments may be re-seeded after import.')
  }

  if (payload.settings.length === 0) {
    warnings.push('Backup contains no settings row.')
  }

  for (const key of BACKUP_TABLE_KEYS) {
    if (!(key in payload)) {
      warnings.push(`Missing table in payload: ${key}`)
    }
  }

  return warnings
}

export async function createBackupEnvelope(
  exportedAt: string = new Date().toISOString(),
): Promise<BackupEnvelope> {
  const payload = await dumpAllTables()
  const encoded = plainJsonCodec.encode(payload)
  const envelope = backupEnvelopeSchema.parse({
    format: 'myfinance-backup',
    schemaVersion: SCHEMA_VERSION,
    appName: APP_NAME,
    exportedAt,
    codec: 'plain',
    payload: encoded,
  })
  recordBackupTimestamp(new Date(exportedAt))
  return envelope
}

export function serializeBackupEnvelope(envelope: BackupEnvelope): string {
  return `${JSON.stringify(envelope, null, 2)}\n`
}

export async function parseBackupText(
  text: string,
): Promise<BackupParseSuccess | BackupParseFailure> {
  const warnings: string[] = []
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Backup file is not valid JSON.', warnings }
  }

  const envelopeResult = backupEnvelopeSchema.safeParse(json)
  if (!envelopeResult.success) {
    return {
      ok: false,
      error: 'Backup envelope failed validation.',
      warnings: envelopeResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ),
    }
  }

  const envelope = envelopeResult.data
  let decoded: Record<string, unknown>
  try {
    decoded = getBackupCodec(envelope.codec).decode(envelope.payload)
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not decode backup payload.',
      warnings,
    }
  }

  const payloadResult = backupPayloadSchema.safeParse(decoded)
  if (!payloadResult.success) {
    return {
      ok: false,
      error: 'Backup payload failed Zod validation.',
      warnings: payloadResult.error.issues.slice(0, 12).map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`,
      ),
    }
  }

  const current = await dumpAllTables()
  const previewWarnings = collectPreviewWarnings(envelope, payloadResult.data, current)

  return {
    ok: true,
    envelope,
    payload: payloadResult.data,
    preview: {
      appName: envelope.appName,
      schemaVersion: envelope.schemaVersion,
      exportedAt: envelope.exportedAt,
      codec: 'plain',
      counts: buildCounts(payloadResult.data),
      warnings: previewWarnings,
    },
  }
}

export async function importBackupPayload(
  payload: BackupPayload,
  mode: BackupImportMode,
): Promise<{ ok: true; warnings: string[] } | { ok: false; error: string }> {
  const warnings: string[] = []
  try {
    if (mode === 'replace') {
      warnings.push('All local data was replaced by the backup.')
      await replaceAllTables(payload)
    } else {
      warnings.push('Backup rows were merged (upserted) into local data.')
      await mergeAllTables(payload)
    }

    // Ensure system seeds exist if backup omitted them.
    await ensureSystemData()
    recordBackupTimestamp()
    return { ok: true, warnings }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not import backup.',
    }
  }
}

export async function exportTransactionsCsvText(): Promise<string> {
  const payload = await dumpAllTables()
  return transactionsToCsv(payload.transactions)
}

/**
 * Wipe all local data and re-seed system defaults. User must complete onboarding again.
 */
export async function resetAllLocalData(): Promise<void> {
  await clearAllTables()
  await ensureSystemData()
  clearBackupTimestamp()
}
