import { db } from '@/db'
import { periodReportSchema } from '@/domain/schemas'
import type { PeriodReport } from '@/domain/types'

export async function listPeriodReports(): Promise<PeriodReport[]> {
  const rows = await db.periodReports.toArray()
  return rows.sort(
    (a, b) =>
      b.periodStart.localeCompare(a.periodStart) ||
      b.createdAt.localeCompare(a.createdAt),
  )
}

export async function getPeriodReport(id: string): Promise<PeriodReport | undefined> {
  return db.periodReports.get(id)
}

export async function getPeriodReportByRange(
  periodStart: string,
  periodEnd: string,
): Promise<PeriodReport | undefined> {
  const rows = await db.periodReports
    .where('periodStart')
    .equals(periodStart)
    .toArray()
  return rows.find((row) => row.periodEnd === periodEnd)
}

export async function savePeriodReport(report: PeriodReport): Promise<PeriodReport> {
  const parsed = periodReportSchema.parse(report)
  await db.periodReports.put(parsed)
  return parsed
}
