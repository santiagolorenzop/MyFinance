import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { useAppState } from '@/app/appState'
import { t } from '@/i18n'
import {
  createBackupEnvelope,
  exportTransactionsCsvText,
  getLastBackupTimestamp,
  importBackupPayload,
  parseBackupText,
  resetAllLocalData,
  serializeBackupEnvelope,
  type BackupImportMode,
  type BackupPreview,
  type BackupPayload,
} from '@/services/backup'

function downloadTextFile(filename: string, contents: string, mime: string) {
  const blob = new Blob([contents], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Backup / restore / CSV / reset — orchestration only; logic lives in backup services.
 */
export function BackupSettingsScreen() {
  const navigate = useNavigate()
  const { refreshSettings } = useAppState()
  const fileRef = useRef<HTMLInputElement>(null)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [preview, setPreview] = useState<BackupPreview | null>(null)
  const [payload, setPayload] = useState<BackupPayload | null>(null)
  const [lastBackupAt, setLastBackupAt] = useState(getLastBackupTimestamp())

  const lastBackupLabel = useMemo(() => {
    if (!lastBackupAt) return t('settings.backupNever')
    return lastBackupAt
  }, [lastBackupAt])

  async function onExportJson() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const envelope = await createBackupEnvelope()
      const stamp = envelope.exportedAt.slice(0, 10)
      downloadTextFile(
        `myfinance-backup-${stamp}.json`,
        serializeBackupEnvelope(envelope),
        'application/json',
      )
      setLastBackupAt(getLastBackupTimestamp())
      setMessage(t('settings.backupExported'))
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function onExportCsv() {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const csv = await exportTransactionsCsvText()
      const stamp = new Date().toISOString().slice(0, 10)
      downloadTextFile(`myfinance-transactions-${stamp}.csv`, csv, 'text/csv')
      setMessage(t('settings.backupCsvExported'))
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function onFileSelected(file: File | null) {
    if (!file) return
    setBusy(true)
    setError(null)
    setMessage(null)
    setPreview(null)
    setPayload(null)
    try {
      const text = await file.text()
      const parsed = await parseBackupText(text)
      if (!parsed.ok) {
        setError(parsed.error || t('settings.backupInvalid'))
        return
      }
      setPreview(parsed.preview)
      setPayload(parsed.payload)
    } catch {
      setError(t('settings.backupInvalid'))
    } finally {
      setBusy(false)
    }
  }

  async function onImport(mode: BackupImportMode) {
    if (!payload) return
    const confirmed = window.confirm(
      mode === 'replace'
        ? t('settings.backupReplaceConfirm')
        : t('settings.backupMergeConfirm'),
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    setMessage(null)
    const result = await importBackupPayload(payload, mode)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    await refreshSettings()
    setLastBackupAt(getLastBackupTimestamp())
    setMessage(t('settings.backupImported'))
    setPreview(null)
    setPayload(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function onReset() {
    const confirmed = window.confirm(t('settings.backupResetConfirm'))
    if (!confirmed) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      await resetAllLocalData()
      await refreshSettings()
      setLastBackupAt(getLastBackupTimestamp())
      setMessage(t('settings.backupResetDone'))
      navigate('/onboarding', { replace: true })
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsLayout
      title={t('settings.backup')}
      heading={t('settings.backup')}
      description={t('settings.backupReminder')}
      error={error}
    >
      <div className="stack">
        <p className="screen__note">{t('settings.backupCodecPlain')}</p>
        <p className="screen__note">
          {t('settings.backupLastLocal')}: {lastBackupLabel}
        </p>

        {message ? (
          <p className="screen__note" role="status">
            {message}
          </p>
        ) : null}

        <button
          type="button"
          className="primary-button"
          disabled={busy}
          onClick={() => void onExportJson()}
        >
          {t('settings.backupExportJson')}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => void onExportCsv()}
        >
          {t('settings.backupExportCsv')}
        </button>

        <div className="stack">
          <p className="field__label">{t('settings.backupImport')}</p>
          <input
            ref={fileRef}
            className="field__control"
            type="file"
            accept="application/json,.json"
            aria-label={t('settings.backupChooseFile')}
            disabled={busy}
            onChange={(event) => {
              void onFileSelected(event.target.files?.[0] ?? null)
            }}
          />
        </div>

        {preview ? (
          <div className="stack skeleton-block">
            <p className="field__label">{t('settings.backupPreview')}</p>
            <p className="screen__note">
              {t('settings.backupExportedAt')}: {preview.exportedAt}
            </p>
            <p className="screen__note">
              {t('settings.backupSchemaVersion')}: {preview.schemaVersion}
            </p>
            <p className="field__label">{t('settings.backupCounts')}</p>
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.entries(preview.counts).map(([key, count]) => (
                <li key={key} className="screen__note">
                  {key}: {count}
                </li>
              ))}
            </ul>
            {preview.warnings.length > 0 ? (
              <div className="stack">
                <p className="field__label">{t('settings.backupWarnings')}</p>
                {preview.warnings.map((warning) => (
                  <p key={warning} className="field__error">
                    {warning}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="inline-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => void onImport('merge')}
              >
                {t('settings.backupMerge')}
              </button>
              <button
                type="button"
                className="danger-button"
                disabled={busy}
                onClick={() => void onImport('replace')}
              >
                {t('settings.backupReplace')}
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="button"
          className="danger-button"
          disabled={busy}
          onClick={() => void onReset()}
        >
          {t('settings.backupReset')}
        </button>
      </div>
    </SettingsLayout>
  )
}
