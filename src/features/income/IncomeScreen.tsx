import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { t } from '@/i18n'
import { filterCategoriesByKind } from '@/services/category'
import { fromMinorUnits, tryParsePositiveAmount } from '@/services/money'
import {
  exchangeRateFinancialDate,
  formatExchangeRateAsOf,
  getCachedRate,
} from '@/services/exchangeRate'
import {
  previewAccountAmountMinor,
  previewBaseAmountMinor,
  quoteCurrencyForBaseRate,
  resolveAccountAmountForSave,
} from '@/services/exchangeRate/moneyEntryFx'
import { suggestFromMemory } from '@/services/suggestion'
import { saveIncomeFlow } from '@/services/income'
import { listAccounts } from '@/repositories/accountsRepository'
import { listCategories } from '@/repositories/categoriesRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { getSettings } from '@/repositories/settingsRepository'
import { listSuggestions } from '@/repositories/suggestionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import type { Account, Category, Currency, TitleSuggestion, Treatment, UserSettings } from '@/domain/types'
import { todayFinancialDate } from '@/utils/dates'

/**
 * Income entry — orchestrates repositories + shared money-entry engine.
 */
export function IncomeScreen() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([])

  const [amount, setAmount] = useState('')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [title, setTitle] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [treatmentId, setTreatmentId] = useState('')
  const [date, setDate] = useState(todayFinancialDate())
  const [notes, setNotes] = useState('')
  const [accountAmount, setAccountAmount] = useState('')
  const [accountAmountManual, setAccountAmountManual] = useState(false)
  const [fxRate, setFxRate] = useState('')
  const [fxRateAsOf, setFxRateAsOf] = useState<string | null>(null)
  const [fxRateSource, setFxRateSource] = useState<string | null>(null)
  const [showMore, setShowMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [nextSettings, nextAccounts, nextCategories, nextCurrencies, nextTreatments, nextSuggestions] =
          await Promise.all([
            getSettings(),
            listAccounts(),
            listCategories(),
            listCurrencies(true),
            listTreatments(),
            listSuggestions(),
          ])
        if (cancelled) return
        setSettings(nextSettings ?? null)
        setAccounts(nextAccounts)
        setCategories(filterCategoriesByKind(nextCategories, 'income'))
        setCurrencies(nextCurrencies)
        setTreatments(nextTreatments.filter((row) => row.isActive && !row.isTransferBehavior))
        setSuggestions(nextSuggestions)
        const nextAccountId =
          nextSettings?.defaultAccountId ??
          nextAccounts.find((row) => row.isDefault)?.id ??
          nextAccounts[0]?.id ??
          ''
        setAccountId(nextAccountId)
        const defaultAccount = nextAccounts.find((row) => row.id === nextAccountId)
        setCurrencyCode(
          defaultAccount?.currencyCode ?? nextSettings?.baseCurrency ?? 'USD',
        )
        const excluded =
          nextTreatments.find((row) => row.behaviorKey === 'excluded')?.id ??
          nextSettings?.defaultTreatmentId ??
          ''
        setTreatmentId(excluded)
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

  const currencyByCode = useMemo(() => {
    const map: Record<string, Currency> = {}
    for (const currency of currencies) map[currency.code] = currency
    return map
  }, [currencies])

  const selectedAccount = accounts.find((row) => row.id === accountId) ?? null
  const amountCurrency = currencyByCode[currencyCode]
  const needsAccountAmount =
    Boolean(selectedAccount) && currencyCode !== selectedAccount!.currencyCode

  const quoteForFx = useMemo(() => {
    if (!settings || !selectedAccount) return null
    return quoteCurrencyForBaseRate({
      originalCurrencyCode: currencyCode,
      accountCurrencyCode: selectedAccount.currencyCode,
      baseCurrencyCode: settings.baseCurrency,
    })
  }, [settings, selectedAccount, currencyCode])

  useEffect(() => {
    if (!settings || !quoteForFx) return
    let cancelled = false
    void (async () => {
      const cached = await getCachedRate(settings.baseCurrency, quoteForFx)
      if (cancelled || !cached) return
      setFxRate((current) => (fxRateSource === 'manual' && current ? current : cached.rate))
      setFxRateAsOf(cached.asOf)
      setFxRateSource((source) => (source === 'manual' ? source : 'cached'))
    })()
    return () => {
      cancelled = true
    }
  }, [settings, quoteForFx, fxRateSource])

  // Auto-fill account amount from FX when currencies differ and user hasn't overridden.
  useEffect(() => {
    if (!settings || !selectedAccount || !needsAccountAmount || accountAmountManual) return
    const originalAmountMinor = tryParsePositiveAmount(
      amount,
      amountCurrency?.decimalPlaces ?? 2,
    )
    if (originalAmountMinor == null || !fxRate.trim()) return
    const currencyMap: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>> = {}
    for (const currency of currencies) {
      currencyMap[currency.code] = {
        code: currency.code,
        decimalPlaces: currency.decimalPlaces,
      }
    }
    const derived = previewAccountAmountMinor({
      originalAmountMinor,
      originalCurrencyCode: currencyCode,
      accountCurrencyCode: selectedAccount.currencyCode,
      baseCurrencyCode: settings.baseCurrency,
      baseQuoteRate: fxRate.trim(),
      quoteCurrencyCode: quoteForFx,
      currencies: currencyMap,
    })
    if (derived == null) return
    setAccountAmount(
      fromMinorUnits(
        derived,
        currencyByCode[selectedAccount.currencyCode]?.decimalPlaces ?? 2,
      ),
    )
  }, [
    settings,
    selectedAccount,
    needsAccountAmount,
    accountAmountManual,
    amount,
    amountCurrency,
    fxRate,
    currencyCode,
    quoteForFx,
    currencies,
    currencyByCode,
  ])

  function selectAccount(nextAccountId: string) {
    setAccountId(nextAccountId)
    const account = accounts.find((row) => row.id === nextAccountId)
    if (account) {
      setCurrencyCode(account.currencyCode)
      setAccountAmount('')
      setAccountAmountManual(false)
    }
  }

  async function onSave() {
    if (!settings || !selectedAccount || saving) return
    const originalAmountMinor = tryParsePositiveAmount(
      amount,
      amountCurrency?.decimalPlaces ?? 2,
    )
    if (originalAmountMinor == null) {
      setError(t('errors.invalidAmount'))
      return
    }

    const currencyMap: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>> = {}
    for (const currency of currencies) {
      currencyMap[currency.code] = {
        code: currency.code,
        decimalPlaces: currency.decimalPlaces,
      }
    }

    const quote = quoteCurrencyForBaseRate({
      originalCurrencyCode: currencyCode,
      accountCurrencyCode: selectedAccount.currencyCode,
      baseCurrencyCode: settings.baseCurrency,
    })
    const baseQuoteRate = quote && fxRate.trim() ? fxRate.trim() : null

    const typedAccountAmount = needsAccountAmount
      ? tryParsePositiveAmount(
          accountAmount,
          currencyByCode[selectedAccount.currencyCode]?.decimalPlaces ?? 2,
        )
      : null
    const resolvedAccount = resolveAccountAmountForSave({
      needsAccountAmount,
      typedAccountAmountMinor: typedAccountAmount,
      originalAmountMinor,
      originalCurrencyCode: currencyCode,
      accountCurrencyCode: selectedAccount.currencyCode,
      baseCurrencyCode: settings.baseCurrency,
      baseQuoteRate,
      quoteCurrencyCode: quote,
      currencies: currencyMap,
    })
    if (!resolvedAccount.ok) {
      setError(t('errors.invalidAmount'))
      return
    }

    const now = new Date().toISOString()
    setSaving(true)
    setError(null)
    const result = await saveIncomeFlow({
      date,
      title,
      notes: notes.trim() || null,
      accountId,
      categoryId,
      treatmentId,
      originalAmountMinor,
      originalCurrencyCode: currencyCode,
      accountCurrencyCode: selectedAccount.currencyCode,
      baseCurrencyCode: settings.baseCurrency,
      accountAmountMinor: resolvedAccount.accountAmountMinor,
      baseQuoteRate,
      quoteCurrencyCode: quote,
      exchangeRateDate: fxRateAsOf
        ? exchangeRateFinancialDate(fxRateAsOf)
        : date,
      exchangeRateSource: fxRateSource,
      currencies: currencyMap,
      createdAt: now,
      updatedAt: now,
    })
    setSaving(false)

    if (!result.ok) {
      setError(result.error || t('income.saveFailed'))
      return
    }
    navigate('/transactions')
  }

  function applyTitleSuggestions(nextTitle: string) {
    setTitle(nextTitle)
    if (!settings?.enableSmartSuggestions) return
    const suggestion = suggestFromMemory(nextTitle, suggestions)
    if (suggestion.accountId) selectAccount(suggestion.accountId)
    if (suggestion.categoryId) setCategoryId(suggestion.categoryId)
    if (suggestion.treatmentId) setTreatmentId(suggestion.treatmentId)
  }

  if (loading) {
    return (
      <AppShell title={t('income.heading')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (accounts.length === 0) {
    return (
      <AppShell title={t('income.heading')}>
        <section className="screen">
          <p className="screen__note">{t('income.noAccounts')}</p>
          <Link className="primary-button" to="/settings/accounts">
            {t('expense.goToAccounts')}
          </Link>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell title={t('income.heading')}>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{t('income.heading')}</h2>
          <p className="screen__subheading">{t('income.howMuch')}</p>
        </div>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        <label className="field">
          <span className="field__label">{t('expense.stepAmount')}</span>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input
              className="field__control"
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder={t('expense.amountPlaceholder')}
            />
            <select
              className="field__control"
              style={{ maxWidth: '7rem' }}
              value={currencyCode}
              onChange={(event) => setCurrencyCode(event.target.value)}
              aria-label={t('expense.changeCurrency')}
            >
              {currencies.map((currency) => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                </option>
              ))}
            </select>
          </div>
        </label>

        <label className="field">
          <span className="field__label">{t('income.whatWasIt')}</span>
          <input
            className="field__control"
            value={title}
            onChange={(event) => applyTitleSuggestions(event.target.value)}
            placeholder={t('income.titlePlaceholder')}
          />
        </label>

        <fieldset className="stack">
          <legend className="field__label">{t('income.whereTo')}</legend>
          {accounts.map((account) => (
            <button
              key={account.id}
              type="button"
              className="list-row"
              style={{ width: '100%', textAlign: 'left' }}
              aria-pressed={accountId === account.id}
              onClick={() => selectAccount(account.id)}
            >
              <span>
                {account.name} ({account.currencyCode})
              </span>
              {accountId === account.id ? <span aria-hidden="true">✓</span> : null}
            </button>
          ))}
        </fieldset>

        <label className="field">
          <span className="field__label">{t('expense.date')}</span>
          <input
            className="field__control"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>

        <label className="field">
          <span className="field__label">{t('expense.category')}</span>
          <select
            className="field__control"
            value={categoryId ?? ''}
            onChange={(event) => setCategoryId(event.target.value || null)}
          >
            <option value="">{t('expense.noCategory')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        {needsAccountAmount ? (
          <label className="field">
            <span className="field__label">{t('expense.accountAmount')}</span>
            <span className="screen__note">{t('expense.accountAmountAutoHint')}</span>
            <input
              className="field__control"
              inputMode="decimal"
              value={accountAmount}
              onChange={(event) => {
                setAccountAmount(event.target.value)
                setAccountAmountManual(true)
              }}
              placeholder={selectedAccount?.currencyCode}
            />
          </label>
        ) : null}

        {quoteForFx && settings ? (
          <div className="stack">
            <label className="field">
              <span className="field__label">
                {t('settings.exchangeRateEdit')} ({settings.baseCurrency}/{quoteForFx})
              </span>
              <input
                className="field__control"
                inputMode="decimal"
                value={fxRate}
                onChange={(event) => {
                  setFxRate(event.target.value)
                  setFxRateSource('manual')
                }}
              />
            </label>
            {fxRateAsOf ? (
              <p className="screen__note">
                {t('settings.exchangeRateOfflineNote')} {formatExchangeRateAsOf(fxRateAsOf)}.
              </p>
            ) : null}
            {(() => {
              const originalAmountMinor = tryParsePositiveAmount(
                amount,
                amountCurrency?.decimalPlaces ?? 2,
              )
              if (originalAmountMinor == null || !selectedAccount) return null
              const currencyMap: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>> = {}
              for (const currency of currencies) {
                currencyMap[currency.code] = {
                  code: currency.code,
                  decimalPlaces: currency.decimalPlaces,
                }
              }
              let accountAmountMinor: number | null = null
              if (needsAccountAmount) {
                accountAmountMinor = tryParsePositiveAmount(
                  accountAmount,
                  currencyByCode[selectedAccount.currencyCode]?.decimalPlaces ?? 2,
                )
              }
              const baseMinor = previewBaseAmountMinor({
                originalAmountMinor,
                originalCurrencyCode: currencyCode,
                accountCurrencyCode: selectedAccount.currencyCode,
                baseCurrencyCode: settings.baseCurrency,
                accountAmountMinor,
                baseQuoteRate: fxRate.trim() || null,
                quoteCurrencyCode: quoteForFx,
                currencies: currencyMap,
              })
              if (baseMinor == null) return null
              return (
                <p className="screen__note">
                  {t('settings.exchangeRateConverted')}:{' '}
                  {fromMinorUnits(
                    baseMinor,
                    currencyByCode[settings.baseCurrency]?.decimalPlaces ?? 2,
                  )}{' '}
                  {settings.baseCurrency}
                </p>
              )
            })()}
          </div>
        ) : null}

        <button type="button" className="secondary-button" onClick={() => setShowMore((v) => !v)}>
          {t('app.moreDetails')}
        </button>

        {showMore ? (
          <div className="stack">
            <label className="field">
              <span className="field__label">{t('expense.treatment')}</span>
              <select
                className="field__control"
                value={treatmentId}
                onChange={(event) => setTreatmentId(event.target.value)}
              >
                {treatments.map((treatment) => (
                  <option key={treatment.id} value={treatment.id}>
                    {treatment.displayName}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">{t('expense.notes')}</span>
              <input
                className="field__control"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </label>
          </div>
        ) : null}

        <div className="stack">
          <button
            type="button"
            className="primary-button"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? t('expense.saving') : t('income.saveIncome')}
          </button>
          <Link className="secondary-button" to="/transactions">
            {t('app.cancel')}
          </Link>
        </div>
      </section>
    </AppShell>
  )
}
