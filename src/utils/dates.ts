import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  getDaysInMonth,
  isAfter,
  isBefore,
  isEqual,
  parse,
  startOfDay,
} from 'date-fns'

/** Local calendar financial date: YYYY-MM-DD */
export type FinancialDate = string

const FINANCIAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export function isFinancialDateString(value: string): boolean {
  return FINANCIAL_DATE_RE.test(value)
}

/**
 * Parse a financial date as a local calendar Date at local midnight.
 * Never uses UTC ISO slicing.
 */
export function parseFinancialDate(date: FinancialDate): Date {
  if (!isFinancialDateString(date)) {
    throw new Error(`Invalid financial date: ${date}`)
  }
  const parsed = parse(date, 'yyyy-MM-dd', new Date())
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid financial date: ${date}`)
  }
  // Guard against JS Date overflow (e.g. 2026-02-31 → March)
  const [y, m, d] = date.split('-').map(Number)
  if (
    parsed.getFullYear() !== y ||
    parsed.getMonth() + 1 !== m ||
    parsed.getDate() !== d
  ) {
    throw new Error(`Invalid financial date: ${date}`)
  }
  return startOfDay(parsed)
}

export function formatFinancialDate(date: Date): FinancialDate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Today's financial date in the local timezone.
 * Optional `now` supports deterministic tests.
 */
export function todayFinancialDate(now: Date = new Date()): FinancialDate {
  return formatFinancialDate(startOfDay(now))
}

/** Clamp day-of-month into the valid range for year/month (month is 1–12). */
export function clampDayOfMonth(year: number, month: number, day: number): number {
  const daysInMonth = getDaysInMonth(new Date(year, month - 1, 1))
  return Math.min(Math.max(1, day), daysInMonth)
}

export function makeClampedDate(year: number, month: number, day: number): FinancialDate {
  const clamped = clampDayOfMonth(year, month, day)
  return formatFinancialDate(new Date(year, month - 1, clamped))
}

export function addCalendarMonthsClamped(
  date: FinancialDate,
  months: number,
  dayOfMonth: number,
): FinancialDate {
  const base = parseFinancialDate(date)
  const shifted = addMonths(base, months)
  return makeClampedDate(shifted.getFullYear(), shifted.getMonth() + 1, dayOfMonth)
}

export function addCalendarDays(date: FinancialDate, days: number): FinancialDate {
  return formatFinancialDate(addDays(parseFinancialDate(date), days))
}

export function compareFinancialDates(a: FinancialDate, b: FinancialDate): number {
  const left = parseFinancialDate(a)
  const right = parseFinancialDate(b)
  if (isBefore(left, right)) return -1
  if (isAfter(left, right)) return 1
  return 0
}

export function isFinancialDateInRangeInclusive(
  date: FinancialDate,
  start: FinancialDate,
  end: FinancialDate,
): boolean {
  const value = parseFinancialDate(date)
  const from = parseFinancialDate(start)
  const to = parseFinancialDate(end)
  return (
    (isEqual(value, from) || isAfter(value, from)) &&
    (isEqual(value, to) || isBefore(value, to))
  )
}

/** Inclusive calendar days from `from` through `to` (both inclusive). */
export function inclusiveCalendarDaysBetween(
  from: FinancialDate,
  to: FinancialDate,
): number {
  const start = parseFinancialDate(from)
  const end = parseFinancialDate(to)
  if (isAfter(start, end)) return 0
  return differenceInCalendarDays(end, start) + 1
}
