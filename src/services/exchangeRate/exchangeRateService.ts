import { putExchangeRate, getExchangeRate, listExchangeRates } from '@/repositories/exchangeRatesRepository'
import type { ExchangeRate } from '@/domain/types'
import { todayFinancialDate } from '@/utils/dates'

export type ExchangeRateRefreshResult =
  | { ok: true; rates: ExchangeRate[]; fetchedAt: string; online: true }
  | { ok: false; error: string; online: boolean; rates: ExchangeRate[] }

const OPEN_ER_API = 'https://open.er-api.com/v6/latest'

function isBrowserOnline(): boolean {
  if (typeof navigator === 'undefined') return true
  return navigator.onLine !== false
}

/**
 * Fetch latest market rates for `baseCurrency` against the given quote codes.
 * Never throws for offline — returns cached rates instead.
 */
export async function refreshExchangeRates(input: {
  baseCurrencyCode: string
  quoteCurrencyCodes: string[]
  fetchImpl?: typeof fetch
}): Promise<ExchangeRateRefreshResult> {
  const cached = await listExchangeRates()
  const quotes = input.quoteCurrencyCodes.filter(
    (code) => code !== input.baseCurrencyCode,
  )

  if (quotes.length === 0) {
    return { ok: true, rates: cached, fetchedAt: new Date().toISOString(), online: true }
  }

  if (!isBrowserOnline()) {
    return {
      ok: false,
      error: 'Offline — using last stored exchange rate.',
      online: false,
      rates: cached,
    }
  }

  const fetchFn = input.fetchImpl ?? fetch
  try {
    const response = await fetchFn(`${OPEN_ER_API}/${encodeURIComponent(input.baseCurrencyCode)}`)
    if (!response.ok) {
      return {
        ok: false,
        error: 'Could not refresh exchange rates.',
        online: true,
        rates: cached,
      }
    }
    const body = (await response.json()) as {
      result?: string
      rates?: Record<string, number>
      time_last_update_utc?: string
    }
    if (body.result !== 'success' || !body.rates) {
      return {
        ok: false,
        error: 'Could not refresh exchange rates.',
        online: true,
        rates: cached,
      }
    }

    const asOf = body.time_last_update_utc
      ? new Date(body.time_last_update_utc).toISOString()
      : new Date().toISOString()
    const now = new Date().toISOString()
    const saved: ExchangeRate[] = []

    for (const quote of quotes) {
      const value = body.rates[quote]
      if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) continue
      const row = await putExchangeRate({
        baseCurrencyCode: input.baseCurrencyCode,
        quoteCurrencyCode: quote,
        rate: String(value),
        asOf,
        source: 'api',
        updatedAt: now,
      })
      saved.push(row)
    }

    return {
      ok: true,
      rates: saved.length > 0 ? saved : await listExchangeRates(),
      fetchedAt: now,
      online: true,
    }
  } catch {
    return {
      ok: false,
      error: 'Could not refresh exchange rates.',
      online: isBrowserOnline(),
      rates: cached,
    }
  }
}

export async function saveManualExchangeRate(input: {
  baseCurrencyCode: string
  quoteCurrencyCode: string
  rate: string
}): Promise<ExchangeRate> {
  return putExchangeRate({
    baseCurrencyCode: input.baseCurrencyCode,
    quoteCurrencyCode: input.quoteCurrencyCode,
    rate: input.rate.trim(),
    asOf: new Date().toISOString(),
    source: 'manual',
  })
}

export async function getCachedRate(
  baseCurrencyCode: string,
  quoteCurrencyCode: string,
): Promise<ExchangeRate | undefined> {
  return getExchangeRate(baseCurrencyCode, quoteCurrencyCode)
}

/** Format a short date label for “Using exchange rate from …”. */
export function formatExchangeRateAsOf(asOf: string): string {
  const date = new Date(asOf)
  if (Number.isNaN(date.getTime())) {
    return asOf.slice(0, 10)
  }
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function exchangeRateFinancialDate(asOf: string): string {
  const date = new Date(asOf)
  if (Number.isNaN(date.getTime())) return todayFinancialDate()
  return todayFinancialDate(date)
}
