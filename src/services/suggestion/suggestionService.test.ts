import { describe, expect, it } from 'vitest'
import {
  normalizeTitle,
  recordSuggestionUsage,
  suggestFromMemory,
} from '@/services/suggestion'

describe('suggestionService', () => {
  it('normalizes titles for matching without changing originals', () => {
    expect(normalizeTitle('  Almuerzo   Sara!! ')).toBe('almuerzo sara')
  })

  it('suggests category from prior usage', () => {
    const memory = recordSuggestionUsage(
      [],
      {
        title: 'Uber aeropuerto',
        normalizedTitle: 'uber aeropuerto',
        categoryId: 'cat-transport',
        accountId: 'acc-1',
        fundId: null,
        treatmentId: 'treat-monthly',
      },
      '2026-07-18T00:00:00.000Z',
    )
    const suggestion = suggestFromMemory('Uber aeropuerto', memory)
    expect(suggestion.categoryId).toBe('cat-transport')
    expect(suggestion.accountId).toBe('acc-1')
  })
})
