import { describe, expect, it } from 'vitest'
import { APP_NAME, SCHEMA_VERSION, UNDO_TIMEOUT_MS } from '@/config/app'
import { MOTION } from '@/config/motion'

describe('app config', () => {
  it('exposes replaceable app name and phase-relevant constants', () => {
    expect(APP_NAME).toBe('MyFinance')
    expect(SCHEMA_VERSION).toBe(1)
    expect(UNDO_TIMEOUT_MS).toBe(5000)
    expect(MOTION.fast).toBe(150)
    expect(MOTION.slow).toBe(250)
  })
})
