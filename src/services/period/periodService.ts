import {
  addCalendarDays,
  addCalendarMonthsClamped,
  compareFinancialDates,
  inclusiveCalendarDaysBetween,
  isFinancialDateInRangeInclusive,
  makeClampedDate,
  parseFinancialDate,
  todayFinancialDate,
  type FinancialDate,
} from '@/utils/dates'

export interface FinancialPeriod {
  start: FinancialDate
  end: FinancialDate
}

/**
 * Resolve the financial period containing `onDate` for a configured start day.
 *
 * Rules:
 * - Start day is clamped to the last valid day of the month when needed (e.g. 31 → Feb 28/29).
 * - If onDate's day >= clamped start day of that month → period starts this month.
 * - Else → period starts previous month (clamped).
 * - End = one calendar month after start, minus one day.
 */
export function getPeriodForDate(
  financialPeriodStartDay: number,
  onDate: FinancialDate,
): FinancialPeriod {
  if (
    !Number.isInteger(financialPeriodStartDay) ||
    financialPeriodStartDay < 1 ||
    financialPeriodStartDay > 31
  ) {
    throw new Error('financialPeriodStartDay must be an integer 1–31')
  }

  const date = parseFinancialDate(onDate)
  const year = date.getFullYear()
  const month = date.getMonth() + 1 // 1–12
  const day = date.getDate()

  const clampedThisMonth = makeClampedDate(year, month, financialPeriodStartDay)
  const clampedThisMonthDay = parseFinancialDate(clampedThisMonth).getDate()

  let start: FinancialDate
  if (day >= clampedThisMonthDay) {
    start = clampedThisMonth
  } else {
    const prevMonthDate = new Date(year, month - 2, 1)
    start = makeClampedDate(
      prevMonthDate.getFullYear(),
      prevMonthDate.getMonth() + 1,
      financialPeriodStartDay,
    )
  }

  const nextStart = addCalendarMonthsClamped(start, 1, financialPeriodStartDay)
  const end = addCalendarDays(nextStart, -1)

  return { start, end }
}

export function getCurrentPeriod(
  financialPeriodStartDay: number,
  now: Date = new Date(),
): FinancialPeriod {
  return getPeriodForDate(financialPeriodStartDay, todayFinancialDate(now))
}

/** Days remaining including today through period end. 0 if today is after end. */
export function daysLeftInPeriod(
  period: FinancialPeriod,
  today: FinancialDate,
): number {
  if (compareFinancialDates(today, period.end) > 0) return 0
  if (compareFinancialDates(today, period.start) < 0) {
    return inclusiveCalendarDaysBetween(period.start, period.end)
  }
  return inclusiveCalendarDaysBetween(today, period.end)
}

export function isDateInPeriod(date: FinancialDate, period: FinancialPeriod): boolean {
  return isFinancialDateInRangeInclusive(date, period.start, period.end)
}

/**
 * Whether a transaction date should count toward "spent so far" in the active period.
 * Future-dated transactions are excluded.
 */
export function isEligibleForActiveSpent(
  date: FinancialDate,
  period: FinancialPeriod,
  today: FinancialDate,
): boolean {
  if (!isDateInPeriod(date, period)) return false
  return compareFinancialDates(date, today) <= 0
}
