import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { AppStateContext } from '@/app/appState'
import { SETTINGS_ROW_ID } from '@/config/app'
import { db, ensureSystemData } from '@/db'
import { t } from '@/i18n'
import { migrateCategoryKinds } from '@/repositories/categoriesRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { refreshExchangeRates } from '@/services/exchangeRate'
import { ensureMissingClosedPeriodSnapshots } from '@/services/report'
import type { UserSettings } from '@/domain/types'

export function AppProviders({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)

  const refreshSettings = useCallback(async () => {
    const row = await db.settings.get(SETTINGS_ROW_ID)
    setSettings(row ?? null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        await ensureSystemData()
        if (cancelled) return
        await migrateCategoryKinds()
        if (cancelled) return
        try {
          await ensureMissingClosedPeriodSnapshots()
        } catch (cause) {
          console.error(cause)
        }
        if (cancelled) return
        await refreshSettings()
        if (!cancelled) setReady(true)

        // Non-blocking FX refresh — never delays app readiness or blocks offline use.
        void (async () => {
          try {
            const row = await db.settings.get(SETTINGS_ROW_ID)
            const base = row?.baseCurrency ?? 'USD'
            const currencies = await listCurrencies(true)
            const quotes = currencies
              .map((c) => c.code)
              .filter((code) => code !== base)
            await refreshExchangeRates({
              baseCurrencyCode: base,
              quoteCurrencyCodes: quotes.length > 0 ? quotes : ['COP'],
            })
          } catch (cause) {
            console.error(cause)
          }
        })()
      } catch (cause) {
        console.error(cause)
        if (!cancelled) {
          setError(t('errors.dbInit'))
          setReady(true)
        }
      }
    }

    void init()
    return () => {
      cancelled = true
    }
  }, [refreshSettings])

  useEffect(() => {
    const theme = settings?.themePreference ?? 'system'
    if (theme === 'system') {
      document.documentElement.removeAttribute('data-theme')
    } else {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [settings?.themePreference])

  const value = useMemo(
    () => ({
      ready,
      error,
      settings,
      refreshSettings,
    }),
    [ready, error, settings, refreshSettings],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}
