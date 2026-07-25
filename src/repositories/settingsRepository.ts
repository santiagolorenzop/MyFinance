import { SETTINGS_ROW_ID } from '@/config/app'
import { db } from '@/db'
import { userSettingsSchema } from '@/domain/schemas'
import type { UserSettings } from '@/domain/types'

export async function getSettings(): Promise<UserSettings | undefined> {
  return db.settings.get(SETTINGS_ROW_ID)
}

export async function updateSettings(
  patch: Partial<Omit<UserSettings, 'id' | 'createdAt'>>,
): Promise<UserSettings> {
  const existing = await db.settings.get(SETTINGS_ROW_ID)
  if (!existing) {
    throw new Error('Settings not initialized')
  }
  const next = userSettingsSchema.parse({
    ...existing,
    ...patch,
    id: SETTINGS_ROW_ID,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  })
  await db.settings.put(next)
  return next
}
