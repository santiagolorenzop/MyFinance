import { describe, expect, it } from 'vitest'
import {
  daysLeftInPeriod,
  getPeriodForDate,
} from '@/services/period'

describe('periodService', () => {
  it('handles period beginning on day 1 (calendar month)', () => {
    expect(getPeriodForDate(1, '2026-07-24')).toEqual({
      start: '2026-07-01',
      end: '2026-07-31',
    })
  })

  it('handles period beginning on day 16', () => {
    expect(getPeriodForDate(16, '2026-07-20')).toEqual({
      start: '2026-07-16',
      end: '2026-08-15',
    })
    expect(getPeriodForDate(16, '2026-07-10')).toEqual({
      start: '2026-06-16',
      end: '2026-07-15',
    })
  })

  it('handles period crossing a year boundary', () => {
    expect(getPeriodForDate(16, '2026-12-20')).toEqual({
      start: '2026-12-16',
      end: '2027-01-15',
    })
  })

  it('clamps start day 31 in February', () => {
    expect(getPeriodForDate(31, '2026-03-05')).toEqual({
      start: '2026-02-28',
      end: '2026-03-30',
    })
  })

  it('handles leap-year February when start day is 31', () => {
    expect(getPeriodForDate(31, '2024-03-05')).toEqual({
      start: '2024-02-29',
      end: '2024-03-30',
    })
  })

  it('counts days left including today', () => {
    const period = { start: '2026-07-16', end: '2026-08-15' }
    expect(daysLeftInPeriod(period, '2026-07-16')).toBe(31)
    expect(daysLeftInPeriod(period, '2026-08-15')).toBe(1)
    expect(daysLeftInPeriod(period, '2026-08-16')).toBe(0)
  })
})
