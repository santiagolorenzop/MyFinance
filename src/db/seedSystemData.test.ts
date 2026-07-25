import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { SETTINGS_ROW_ID } from '@/config/app'
import { db } from '@/db/database'
import { ensureSystemData } from '@/db/seedSystemData'

describe('ensureSystemData', () => {
  beforeEach(async () => {
    await db.delete()
    db.close()
    // Re-open by accessing a table after delete
    await db.open()
  })

  it('seeds currencies, system treatments, and default settings once', async () => {
    await ensureSystemData()
    await ensureSystemData()

    const currencies = await db.currencies.count()
    const treatments = await db.treatments.toArray()
    const settings = await db.settings.get(SETTINGS_ROW_ID)

    expect(currencies).toBeGreaterThanOrEqual(2)
    expect(treatments).toHaveLength(4)
    expect(treatments.every((item) => item.isSystem)).toBe(true)
    expect(settings?.onboardingCompleted).toBe(false)
    expect(settings?.preferredLanguage).toBe('en')
    expect(settings?.defaultTreatmentId).toBeTruthy()
  })
})
