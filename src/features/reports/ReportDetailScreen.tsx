import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { CompactProgress } from '@/components/ui/CompactProgress'
import { t } from '@/i18n'
import { fromMinorUnits } from '@/services/money'
import {
  reportUsesFrozenSnapshot,
  totalsFromSnapshot,
} from '@/services/report'
import { categoryStatus } from '@/services/budget'
import { getPeriodReport } from '@/repositories/reportsRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import type { Currency, PeriodReport } from '@/domain/types'
import type { CategoryBudgetStatus } from '@/services/budget'

function progressTone(status: CategoryBudgetStatus): 'normal' | 'near' | 'over' {
  if (status === 'over_budget') return 'over'
  if (status === 'near_limit') return 'near'
  return 'normal'
}

/**
 * Closed period report detail — reads frozen snapshot totals only.
 */
export function ReportDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [report, setReport] = useState<PeriodReport | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!id) return
      try {
        const [nextReport, nextCurrencies] = await Promise.all([
          getPeriodReport(id),
          listCurrencies(),
        ])
        if (cancelled) return
        setReport(nextReport ?? null)
        setCurrencies(nextCurrencies)
      } catch {
        if (!cancelled) setError(t('errors.generic'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const totals = useMemo(() => (report ? totalsFromSnapshot(report) : null), [report])

  const baseDp = useMemo(() => {
    if (!report) return 2
    return currencies.find((row) => row.code === report.baseCurrencyCode)?.decimalPlaces ?? 2
  }, [currencies, report])

  if (loading) {
    return (
      <AppShell title={t('reports.periodDetail')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (!report || !totals) {
    return (
      <AppShell title={t('reports.periodDetail')}>
        <section className="screen">
          <p className="screen__note">{t('movements.notFound')}</p>
          <Link className="primary-button" to="/reports">
            {t('app.back')}
          </Link>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell title={t('reports.periodDetail')}>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{t('reports.periodDetail')}</h2>
          <p>
            {report.periodStart} → {report.periodEnd}
          </p>
          {reportUsesFrozenSnapshot(report) ? (
            <p className="screen__note">{t('reports.frozenNote')}</p>
          ) : null}
        </div>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="stat-grid">
          <div className="stat-cell">
            <span className="field__label">{t('monthlyStats.totalBudget')}</span>
            <span className="stat-cell__value">
              {fromMinorUnits(totals.totalBudgetMinor, baseDp)} {report.baseCurrencyCode}
            </span>
          </div>
          <div className="stat-cell">
            <span className="field__label">{t('monthlyStats.spent')}</span>
            <span className="stat-cell__value">
              {fromMinorUnits(totals.totalSpentMinor, baseDp)} {report.baseCurrencyCode}
            </span>
          </div>
          <div className="stat-cell">
            <span className="field__label">{t('monthlyStats.remaining')}</span>
            <span className="stat-cell__value">
              {fromMinorUnits(totals.remainingMinor, baseDp)} {report.baseCurrencyCode}
            </span>
          </div>
        </div>

        <div className="stack">
          <p className="field__label">{t('monthlyStats.categories')}</p>
          {report.snapshotData.map((row) => {
            const status = categoryStatus(row.allocatedAmountMinor, row.spentAmountMinor)
            return (
              <div key={row.categoryId} className="stack">
                <span
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}
                >
                  <span>{row.categoryDisplayName}</span>
                  <span>
                    {fromMinorUnits(row.spentAmountMinor, baseDp)} /{' '}
                    {fromMinorUnits(row.allocatedAmountMinor, baseDp)}
                  </span>
                </span>
                <CompactProgress
                  ratio={row.percentageUsed}
                  label={row.categoryDisplayName}
                  tone={progressTone(status)}
                />
              </div>
            )
          })}
        </div>

        <Link className="secondary-button" to="/reports">
          {t('app.back')}
        </Link>
      </section>
    </AppShell>
  )
}
