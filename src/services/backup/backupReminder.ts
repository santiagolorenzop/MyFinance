import { APP_ID } from '@/config/app'

const LAST_BACKUP_KEY = `${APP_ID}.lastBackupAt`
/** Subtle reminder after this many days without a backup. */
export const BACKUP_REMINDER_DAYS = 14

export function recordBackupTimestamp(now: Date = new Date()): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAST_BACKUP_KEY, now.toISOString())
}

export function getLastBackupTimestamp(): string | null {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(LAST_BACKUP_KEY)
}

export function clearBackupTimestamp(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(LAST_BACKUP_KEY)
}

/**
 * Whether to show a subtle backup reminder.
 * Pure relative to `now` + stored timestamp — no financial logic.
 */
export function shouldShowBackupReminder(
  now: Date = new Date(),
  reminderDays = BACKUP_REMINDER_DAYS,
): boolean {
  const last = getLastBackupTimestamp()
  if (!last) return true
  const lastMs = Date.parse(last)
  if (!Number.isFinite(lastMs)) return true
  const elapsedDays = (now.getTime() - lastMs) / (24 * 60 * 60 * 1000)
  return elapsedDays >= reminderDays
}
