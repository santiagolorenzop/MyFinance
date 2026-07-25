import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { CompactProgress } from '@/components/ui/CompactProgress'
import { t } from '@/i18n'
import { fromMinorUnits } from '@/services/money'
import {
  buildLiveCustomRangeReport,
  closePreviousPeriodFlow,
  listClosedReports,
  type CustomRangeReport,
} from '@/services/report'
import type { CategoryBudgetStatus } from '@/services/budget'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { getSettings } from '@/repositories/settingsRepository'
import type { Currency, PeriodReport, UserSettings } from '@/domain/types'
import { todayFinancialDate } from '@/utils/dates'

function progressTone(status: CategoryBudgetStatus): 'normal' | 'near' | 'over' {
  if (status === 'over_budget') return 'over'
  if (status === 'near_limit') return 'near'
  return 'normal'
}

/**
 * Reports list, close previous period, and live custom-range report.
 */
export function ReportsScreen() {
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [reports, setReports] = useState<PeriodReport[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState(todayFinancialDate())
  const [custom, setCustom] = useState<CustomRangeReport | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [nextSettings, nextReports, nextCurrencies] = await Promise.all([
          getSettings(),
          listClosedReports(),
          listCurrencies(),
        ])
        if (cancelled) return
        setSettings(nextSettings ?? null)
        setReports(nextReports)
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
  }, [])

  const baseDp = useMemo(() => {
    const code = settings?.baseCurrency ?? 'USD'
    return currencies.find((row) => row.code === code)?.decimalPlaces ?? 2
  }, [currencies, settings?.baseCurrency])

  async function onClosePrevious() {
    setBusy(true)
    setError(null)
    setMessage(null)
    const result = await closePreviousPeriodFlow()
    setBusy(false)
    if (!result.ok) {
      setError(result.error || t('reports.closeFailed'))
      return
    }
    if (result.report == null) {
      setMessage(t('reports.nothingToClose'))
      return
    }
    setMessage(t('reports.closeSuccess'))
    setReports(await listClosedReports())
  }

  async function onGenerateCustom() {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) {
      setError(t('reports.noCustom'))
      return
    }
    setBusy(true)
    setError(null)
    const result = await buildLiveCustomRangeReport({
      start: rangeStart,
      end: rangeEnd,
    })
    setBusy(false)
    if (!result) {
      setError(t('errors.generic'))
      return
    }
    setCustom(result)
  }

  if (loading || !settings) {
    return (
      <AppShell title={t('reports.heading')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell title={t('reports.heading')}>
      <section className="screen">
        <h2 className="screen__heading">{t('reports.heading')}</h2>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="screen__note" role="status">
            {message}
          </p>
        ) : null}

        <div className="stack">
          <p className="screen__note">{t('reports.closePreviousHint')}</p>
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => void onClosePrevious()}
          >
            {t('reports.closePrevious')}
          </button>
        </div>

        <div className="stack">
          <p className="field__label">{t('reports.closedPeriods')}</p>
          {reports.length === 0 ? (
            <p className="screen__note">{t('reports.empty')}</p>
          ) : (
            <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {reports.map((report) => (
                <li key={report.id}>
                  <Link
                    className="list-row"
                    to={`/reports/${report.id}`}
                    style={{ width: '100%', textDecoration: 'none', color: 'inherit' }}
                  >
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span>
                        {report.periodStart} → {report.periodEnd}
                      </span>
                      <span className="screen__note">{t('reports.closed')}</span>
                    </span>
                    <span>
                      {fromMinorUnits(report.totalSpentMinor, baseDp)} {report.baseCurrencyCode}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="stack skeleton-block">
          <p className="field__label">{t('reports.customRange')}</p>
          <label className="field">
            <span className="field__label">{t('movements.dateFrom')}</span>
            <input
              className="field__control"
              type="date"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field__label">{t('movements.dateTo')}</span>
            <input
              className="field__control"
              type="date"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="primary-button"
            disabled={busy}
            onClick={() => void onGenerateCustom()}
          >
            {t('reports.generateCustom')}
          </button>
        </div>

        {custom ? (
          <div className="stack">
            <p className="field__label">{t('reports.customResult')}</p>
            <p className="screen__note">{t('reports.liveNote')}</p>
            <p>
              {custom.start} → {custom.end}
            </p>
            <p className="stat-cell__value">
              {fromMinorUnits(custom.totalSpentMinor, baseDp)} {settings.baseCurrency}
            </p>
            <p className="screen__note">
              {t('reports.matchingMovements')}: {custom.matchingTransactionIds.length}
            </p>
            {custom.categories.map((row) => (
              <div key={row.categoryId} className="stack">
                <span
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 'var(--space-3)',
                  }}
                >
                  <span>{row.categoryName}</span>
                  <span>
                    {fromMinorUnits(row.spentMinor, baseDp)} /{' '}
                    {fromMinorUnits(row.allocatedMinor, baseDp)}
                  </span>
                </span>
                <CompactProgress
                  ratio={row.percentageUsed}
                  label={row.categoryName}
                  tone={progressTone(row.status)}
                />
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </AppShell>
  )
}
