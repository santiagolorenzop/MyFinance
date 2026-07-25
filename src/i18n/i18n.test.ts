import { describe, expect, it } from 'vitest'
import { t } from '@/i18n'

describe('i18n', () => {
  it('resolves English UI strings from the catalog', () => {
    expect(t('expense.heading')).toBe('Add expense')
    expect(t('nav.movements')).toBe('Movements')
    expect(t('onboarding.welcomeTitle')).toContain('organized your way')
  })

  it('returns the key for missing translations in a safe way', () => {
    // @ts-expect-error intentional invalid key for runtime fallback
    expect(t('does.not.exist')).toBe('does.not.exist')
  })
})
