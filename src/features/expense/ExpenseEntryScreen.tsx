import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { UndoToast } from '@/components/ui/UndoToast'
import { UNDO_TIMEOUT_MS } from '@/config/app'
import { t } from '@/i18n'
import { tryParsePositiveAmount } from '@/services/money'
import { suggestFromMemory } from '@/services/suggestion'
import { rankAccountsForPicker } from '@/services/account'
import {
  rankCategoriesForPicker,
  recentTitleSuggestions,
} from '@/services/category'
import {
  saveExpenseFlow,
  undoExpenseFlow,
  type UndoSession,
} from '@/services/expense'
import {
  createSpeechListenSession,
  getVoiceParser,
  isSpeechRecognitionSupported,
  voiceParseRequiresConfirmation,
  type SpeechListenSession,
  type VoiceParseResult,
} from '@/services/voiceParser'
import type { EntrySource } from '@/domain/enums'
import { listAccounts } from '@/repositories/accountsRepository'
import { listCategories } from '@/repositories/categoriesRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { listFunds } from '@/repositories/fundsRepository'
import { getSettings } from '@/repositories/settingsRepository'
import { listSuggestions } from '@/repositories/suggestionsRepository'
import { listRecentTransactions } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import type {
  Account,
  Category,
  Currency,
  Fund,
  TitleSuggestion,
  Transaction,
  Treatment,
  UserSettings,
} from '@/domain/types'
import { todayFinancialDate } from '@/utils/dates'

type ExpenseStep = 'amount' | 'title' | 'account' | 'confirm'

const STEP_ORDER: ExpenseStep[] = ['amount', 'title', 'account', 'confirm']

interface DraftState {
  amount: string
  currencyCode: string
  title: string
  accountId: string
  categoryId: string | null
  fundId: string | null
  treatmentId: string
  date: string
  notes: string
  accountAmount: string
  categoryTouched: boolean
  accountTouched: boolean
  entrySource: EntrySource
}

function emptyDraft(
  currencyCode: string,
  accountId: string,
  treatmentId: string,
  fundId: string | null,
): DraftState {
  return {
    amount: '',
    currencyCode,
    title: '',
    accountId,
    categoryId: null,
    fundId,
    treatmentId,
    date: todayFinancialDate(),
    notes: '',
    accountAmount: '',
    categoryTouched: false,
    accountTouched: false,
    entrySource: 'manual',
  }
}

/**
 * Quick expense entry on `/`.
 * UI orchestrates repositories + Phase 2 engine; no financial formulas live here.
 */
export function ExpenseEntryScreen() {
  const amountRef = useRef<HTMLInputElement>(null)
  const undoTimerRef = useRef<number | null>(null)
  const speechSessionRef = useRef<SpeechListenSession | null>(null)

  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<UserSettings | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [suggestions, setSuggestions] = useState<TitleSuggestion[]>([])
  const [recentTx, setRecentTx] = useState<Transaction[]>([])

  const [step, setStep] = useState<ExpenseStep>('amount')
  const [draft, setDraft] = useState<DraftState | null>(null)
  const [showMore, setShowMore] = useState(false)
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false)
  const [categoryQuery, setCategoryQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [undoSession, setUndoSession] = useState<UndoSession | null>(null)
  const [undoVisible, setUndoVisible] = useState(false)
  const [undoBusy, setUndoBusy] = useState(false)
  const [utterance, setUtterance] = useState('')
  const [listening, setListening] = useState(false)
  const [voiceParse, setVoiceParse] = useState<VoiceParseResult | null>(null)
  const speechSupported = isSpeechRecognitionSupported()

  async function reloadReferenceData() {
    const [
      nextSettings,
      nextAccounts,
      nextCategories,
      nextFunds,
      nextTreatments,
      nextCurrencies,
      nextSuggestions,
      nextRecent,
    ] = await Promise.all([
      getSettings(),
      listAccounts(),
      listCategories(),
      listFunds(),
      listTreatments(),
      listCurrencies(true),
      listSuggestions(),
      listRecentTransactions(40),
    ])

    setSettings(nextSettings ?? null)
    setAccounts(nextAccounts)
    setCategories(nextCategories)
    setFunds(nextFunds)
    setTreatments(nextTreatments.filter((row) => row.isActive && !row.isTransferBehavior))
    setCurrencies(nextCurrencies)
    setSuggestions(nextSuggestions)
    setRecentTx(nextRecent)

    return {
      settings: nextSettings,
      accounts: nextAccounts,
      treatments: nextTreatments,
    }
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const data = await reloadReferenceData()
        if (cancelled) return
        const base = data.settings?.baseCurrency ?? 'USD'
        const defaultAccountId =
          data.settings?.defaultAccountId ??
          data.accounts.find((row) => row.isDefault)?.id ??
          data.accounts[0]?.id ??
          ''
        const treatmentId =
          data.settings?.defaultTreatmentId ??
          data.treatments.find((row) => row.behaviorKey === 'monthly_budget')?.id ??
          ''
        setDraft(
          emptyDraft(
            base,
            defaultAccountId,
            treatmentId,
            data.settings?.defaultFundId ?? null,
          ),
        )
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

  useEffect(() => {
    return () => {
      if (undoTimerRef.current != null) {
        window.clearTimeout(undoTimerRef.current)
      }
      speechSessionRef.current?.abort()
      speechSessionRef.current = null
    }
  }, [])

  const currencyByCode = useMemo(() => {
    const map: Record<string, Currency> = {}
    for (const currency of currencies) map[currency.code] = currency
    return map
  }, [currencies])

  const selectedAccount = useMemo(
    () => accounts.find((row) => row.id === draft?.accountId) ?? null,
    [accounts, draft?.accountId],
  )

  const amountCurrency = draft ? currencyByCode[draft.currencyCode] : undefined
  const needsAccountAmount =
    Boolean(draft && selectedAccount) &&
    draft!.currencyCode !== selectedAccount!.currencyCode

  const rankedAccounts = useMemo(() => {
    if (!settings) return []
    return rankAccountsForPicker({
      accounts,
      defaultAccountId: settings.defaultAccountId,
      recentTransactions: recentTx,
      suggestions,
    })
  }, [accounts, recentTx, settings, suggestions])

  const rankedCategories = useMemo(() => {
    if (!draft) return []
    return rankCategoriesForPicker({
      categories,
      suggestedCategoryId: draft.categoryId,
      recentTransactions: recentTx,
      suggestions,
      kind: 'expense',
    })
  }, [draft, categories, recentTx, suggestions])

  const filteredCategories = useMemo(() => {
    const query = categoryQuery.trim().toLowerCase()
    if (!query) return rankedCategories
    return rankedCategories.filter((row) =>
      row.category.name.toLowerCase().includes(query),
    )
  }, [categoryQuery, rankedCategories])

  const titleChips = useMemo(
    () => recentTitleSuggestions(suggestions, 6),
    [suggestions],
  )

  const stepIndex = STEP_ORDER.indexOf(step)

  function patchDraft(patch: Partial<DraftState>) {
    setDraft((current) => (current ? { ...current, ...patch } : current))
  }

  function applySuggestionsForTitle(title: string, current: DraftState): DraftState {
    if (!settings?.enableSmartSuggestions) return { ...current, title }
    const suggestion = suggestFromMemory(title, suggestions)
    return {
      ...current,
      title,
      categoryId: current.categoryTouched
        ? current.categoryId
        : (suggestion.categoryId ?? current.categoryId),
      accountId: current.accountTouched
        ? current.accountId
        : (suggestion.accountId ?? current.accountId),
      fundId: suggestion.fundId ?? current.fundId,
      treatmentId: suggestion.treatmentId ?? current.treatmentId,
    }
  }

  function canContinue(): boolean {
    if (!draft) return false
    if (step === 'amount') {
      return (
        tryParsePositiveAmount(
          draft.amount,
          amountCurrency?.decimalPlaces ?? 2,
        ) != null
      )
    }
    if (step === 'title') return draft.title.trim().length > 0
    if (step === 'account') return draft.accountId.length > 0
    if (step === 'confirm') {
      if (needsAccountAmount) {
        const accountCurrency = currencyByCode[selectedAccount!.currencyCode]
        return (
          tryParsePositiveAmount(
            draft.accountAmount,
            accountCurrency?.decimalPlaces ?? 2,
          ) != null
        )
      }
      return true
    }
    return false
  }

  function clearUndoTimer() {
    if (undoTimerRef.current != null) {
      window.clearTimeout(undoTimerRef.current)
      undoTimerRef.current = null
    }
  }

  function startUndoWindow(session: UndoSession) {
    clearUndoTimer()
    setUndoSession(session)
    setUndoVisible(true)
    undoTimerRef.current = window.setTimeout(() => {
      setUndoVisible(false)
      setUndoSession(null)
      undoTimerRef.current = null
    }, UNDO_TIMEOUT_MS)
  }

  function resetDraftKeepingDefaults() {
    if (!settings) return
    const base = settings.baseCurrency
    const defaultAccountId =
      settings.defaultAccountId ??
      accounts.find((row) => row.isDefault)?.id ??
      accounts[0]?.id ??
      ''
    const treatmentId =
      settings.defaultTreatmentId ??
      treatments.find((row) => row.behaviorKey === 'monthly_budget')?.id ??
      draft?.treatmentId ??
      ''
    setDraft(emptyDraft(base, defaultAccountId, treatmentId, settings.defaultFundId))
    setStep('amount')
    setShowMore(false)
    setShowCurrencyPicker(false)
    setCategoryQuery('')
    setUtterance('')
    setVoiceParse(null)
    setError(null)
    window.requestAnimationFrame(() => {
      amountRef.current?.focus()
    })
  }

  function applyVoiceUtterance(text: string) {
    if (!settings) return
    setDraft((current) => {
      if (!current) return current

      const parsed = getVoiceParser().parse(text, {
        today: todayFinancialDate(),
        defaultCurrencyCode: current.currencyCode || settings.baseCurrency,
        accounts: accounts.map((account) => ({ id: account.id, name: account.name })),
        currencies: currencies.map((currency) => ({
          code: currency.code,
          symbol: currency.symbol,
        })),
      })

      // Never silent-save voice/parsed entries — confirmation is mandatory.
      void voiceParseRequiresConfirmation(parsed)
      setVoiceParse(parsed)
      setUtterance(text)

      if (!parsed.amountText && !parsed.title) {
        setError(t('expense.voiceParseFailed'))
        return current
      }

      let next: DraftState = {
        ...current,
        entrySource: 'voice',
        amount: parsed.amountText ?? current.amount,
        currencyCode: parsed.currencyCode ?? current.currencyCode,
        date: parsed.date ?? current.date,
        accountId: parsed.accountId ?? current.accountId,
        accountTouched: parsed.accountId != null ? true : current.accountTouched,
      }

      if (parsed.title) {
        next = applySuggestionsForTitle(parsed.title, {
          ...next,
          categoryTouched: false,
        })
      }

      setError(null)
      setStep('confirm')
      return next
    })
  }

  function startListening() {
    if (!settings?.enableVoiceInput || listening) return
    const session = createSpeechListenSession({
      lang: settings.locale || 'en-US',
      onFinal: (transcript) => {
        setListening(false)
        speechSessionRef.current = null
        setUtterance(transcript)
        applyVoiceUtterance(transcript)
      },
      onError: () => {
        setListening(false)
        speechSessionRef.current = null
        setError(t('expense.voiceUnavailable'))
      },
      onEnd: () => {
        setListening(false)
        speechSessionRef.current = null
      },
    })
    if (!session) {
      setError(t('expense.voiceUnavailable'))
      return
    }
    speechSessionRef.current = session
    setListening(true)
    setError(null)
    session.start()
  }

  function stopListening() {
    speechSessionRef.current?.stop()
    setListening(false)
  }

  async function persistExpense() {
    if (!draft || !settings || !selectedAccount || saving) return
    const originalCurrency = currencyByCode[draft.currencyCode]
    if (!originalCurrency) {
      setError(t('errors.generic'))
      return
    }

    const originalAmountMinor = tryParsePositiveAmount(
      draft.amount,
      originalCurrency.decimalPlaces,
    )
    if (originalAmountMinor == null) {
      setError(t('errors.invalidAmount'))
      return
    }

    let accountAmountMinor: number | null = null
    if (needsAccountAmount) {
      const accountCurrency = currencyByCode[selectedAccount.currencyCode]
      accountAmountMinor = tryParsePositiveAmount(
        draft.accountAmount,
        accountCurrency?.decimalPlaces ?? 2,
      )
      if (accountAmountMinor == null) {
        setError(t('errors.invalidAmount'))
        return
      }
    }

    const currencyMap: Record<string, Pick<Currency, 'code' | 'decimalPlaces'>> = {}
    for (const currency of currencies) {
      currencyMap[currency.code] = {
        code: currency.code,
        decimalPlaces: currency.decimalPlaces,
      }
    }

    const now = new Date().toISOString()
    setSaving(true)
    setError(null)
    try {
      const result = await saveExpenseFlow({
        date: draft.date,
        title: draft.title,
        notes: draft.notes.trim() || null,
        accountId: draft.accountId,
        categoryId: draft.categoryId,
        fundId: draft.fundId,
        treatmentId: draft.treatmentId,
        originalAmountMinor,
        originalCurrencyCode: draft.currencyCode,
        accountCurrencyCode: selectedAccount.currencyCode,
        baseCurrencyCode: settings.baseCurrency,
        accountAmountMinor,
        currencies: currencyMap,
        entrySource: draft.entrySource,
        createdAt: now,
        updatedAt: now,
      })

      if (!result.ok) {
        setError(result.error || t('expense.saveFailed'))
        return
      }

      startUndoWindow(result.session)
      await reloadReferenceData()
      resetDraftKeepingDefaults()
    } catch {
      setError(t('expense.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUndo() {
    if (!undoSession || undoBusy) return
    setUndoBusy(true)
    try {
      const result = await undoExpenseFlow({ session: undoSession })
      if (!result.ok) {
        setError(t('expense.undoFailed'))
        return
      }
      clearUndoTimer()
      setUndoVisible(false)
      setUndoSession(null)
      await reloadReferenceData()
    } catch {
      setError(t('expense.undoFailed'))
    } finally {
      setUndoBusy(false)
    }
  }

  function goNext() {
    if (!draft || !canContinue()) return
    setError(null)

    if (step === 'title') {
      setDraft(applySuggestionsForTitle(draft.title, draft))
    }

    if (step === 'account') {
      // Voice/parsed entries never skip confirmation.
      const canSkipConfirm =
        settings &&
        !settings.requireConfirmationBeforeSaving &&
        draft.entrySource !== 'voice'
      if (canSkipConfirm) {
        void persistExpense()
        return
      }
    }

    if (stepIndex < STEP_ORDER.length - 1) {
      setStep(STEP_ORDER[stepIndex + 1])
    }
  }

  function goBack() {
    if (stepIndex > 0) {
      setError(null)
      setStep(STEP_ORDER[stepIndex - 1])
    }
  }

  if (loading) {
    return (
      <AppShell>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (!draft || !settings) {
    return (
      <AppShell>
        <section className="screen">
          <p className="field__error" role="alert">
            {error ?? t('errors.generic')}
          </p>
        </section>
      </AppShell>
    )
  }

  if (accounts.length === 0) {
    return (
      <AppShell>
        <section className="screen">
          <div className="stack">
            <h2 className="screen__heading">{t('expense.heading')}</h2>
            <p className="screen__note">{t('expense.noAccounts')}</p>
            <Link className="primary-button" to="/settings/accounts">
              {t('expense.goToAccounts')}
            </Link>
          </div>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{t('expense.heading')}</h2>
        </div>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        {step === 'amount' ? (
          <div className="stack">
            <p className="screen__subheading">{t('expense.howMuch')}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                ref={amountRef}
                className="amount-input"
                inputMode="decimal"
                autoFocus
                aria-label={t('expense.howMuch')}
                placeholder={t('expense.amountPlaceholder')}
                value={draft.amount}
                onChange={(event) => patchDraft({ amount: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canContinue()) goNext()
                }}
              />
              <button
                type="button"
                className="currency-chip"
                aria-label={t('expense.changeCurrency')}
                aria-expanded={showCurrencyPicker}
                onClick={() => setShowCurrencyPicker((value) => !value)}
              >
                {draft.currencyCode}
              </button>
            </div>
            {showCurrencyPicker ? (
              <div className="currency-picker" role="listbox" aria-label={t('expense.selectCurrency')}>
                {currencies.map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    className="list-row"
                    style={{ width: '100%', textAlign: 'left' }}
                    role="option"
                    aria-selected={draft.currencyCode === currency.code}
                    onClick={() => {
                      patchDraft({ currencyCode: currency.code })
                      setShowCurrencyPicker(false)
                    }}
                  >
                    {currency.code} · {currency.displayName}
                  </button>
                ))}
              </div>
            ) : null}

            {settings.enableVoiceInput ? (
              <div className="stack">
                <label className="field">
                  <span className="field__label">{t('expense.voiceUtterance')}</span>
                  <input
                    className="field__control"
                    enterKeyHint="done"
                    autoComplete="off"
                    autoCorrect="on"
                    spellCheck
                    placeholder={t('expense.voiceUtterancePlaceholder')}
                    value={utterance}
                    onChange={(event) => setUtterance(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && utterance.trim()) {
                        event.preventDefault()
                        applyVoiceUtterance(utterance)
                      }
                    }}
                  />
                </label>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!utterance.trim()}
                    onClick={() => applyVoiceUtterance(utterance)}
                  >
                    {t('expense.parseUtterance')}
                  </button>
                  {speechSupported ? (
                    <button
                      type="button"
                      className="secondary-button"
                      aria-pressed={listening}
                      onClick={() => {
                        if (listening) stopListening()
                        else startListening()
                      }}
                    >
                      {listening ? t('expense.stopListening') : t('expense.dictation')}
                    </button>
                  ) : null}
                </div>
                {listening ? (
                  <p className="screen__note" role="status">
                    {t('expense.listening')}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 'title' ? (
          <div className="stack">
            <p className="screen__subheading">{t('expense.whatWasIt')}</p>
            <input
              className="amount-input"
              style={{ fontSize: 'var(--font-size-xl)' }}
              autoFocus
              aria-label={t('expense.whatWasIt')}
              placeholder={t('expense.titlePlaceholder')}
              value={draft.title}
              onChange={(event) => patchDraft({ title: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canContinue()) goNext()
              }}
            />
            {titleChips.length > 0 ? (
              <div className="stack">
                <p className="section-label">{t('expense.recentTitles')}</p>
                <div className="chip-row">
                  {titleChips.map((title) => (
                    <button
                      key={title}
                      type="button"
                      className="chip"
                      onClick={() => {
                        setDraft((current) =>
                          current
                            ? applySuggestionsForTitle(title, {
                                ...current,
                                categoryTouched: false,
                                accountTouched: false,
                              })
                            : current,
                        )
                      }}
                    >
                      {title}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 'account' ? (
          <div className="stack">
            <p className="screen__subheading">{t('expense.whereFrom')}</p>
            {rankedAccounts.map(({ account }) => (
              <button
                key={account.id}
                type="button"
                className="list-row"
                style={{ width: '100%', textAlign: 'left' }}
                onClick={() =>
                  patchDraft({ accountId: account.id, accountTouched: true })
                }
                aria-pressed={draft.accountId === account.id}
              >
                <span>{account.name}</span>
                {draft.accountId === account.id ? <span aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
        ) : null}

        {step === 'confirm' ? (
          <div className="stack">
            <p className="screen__subheading">{t('expense.confirm')}</p>
            <p>
              <strong>
                {draft.amount} {draft.currencyCode}
              </strong>
            </p>
            <p>{draft.title}</p>
            <p className="screen__note">{selectedAccount?.name}</p>

            {draft.entrySource === 'voice' && voiceParse ? (
              <div className="stack">
                <p className="screen__note">{t('expense.voiceParsed')}</p>
                <p className="screen__note">
                  {t('expense.voiceConfidence')}: {Math.round(voiceParse.confidence * 100)}%
                </p>
                <p className="screen__note">{t('expense.voiceRequiresConfirm')}</p>
              </div>
            ) : null}

            <label className="field">
              <span className="field__label">{t('expense.date')}</span>
              <input
                className="field__control"
                type="date"
                value={draft.date}
                onChange={(event) => patchDraft({ date: event.target.value })}
              />
            </label>

            {needsAccountAmount ? (
              <label className="field">
                <span className="field__label">{t('expense.accountAmount')}</span>
                <span className="screen__note">{t('expense.accountAmountHint')}</span>
                <input
                  className="field__control"
                  inputMode="decimal"
                  value={draft.accountAmount}
                  onChange={(event) => patchDraft({ accountAmount: event.target.value })}
                  placeholder={selectedAccount?.currencyCode}
                />
              </label>
            ) : null}

            <div className="stack">
              <p className="field__label">{t('expense.category')}</p>
              <input
                className="field__control"
                value={categoryQuery}
                onChange={(event) => setCategoryQuery(event.target.value)}
                placeholder={t('expense.searchCategories')}
                aria-label={t('expense.searchCategories')}
              />
              <button
                type="button"
                className="list-row"
                style={{ width: '100%', textAlign: 'left' }}
                aria-pressed={draft.categoryId == null}
                onClick={() =>
                  patchDraft({ categoryId: null, categoryTouched: true })
                }
              >
                {t('expense.noCategory')}
                {draft.categoryId == null ? <span aria-hidden="true">✓</span> : null}
              </button>
              {filteredCategories.map(({ category }) => (
                <button
                  key={category.id}
                  type="button"
                  className="list-row"
                  style={{ width: '100%', textAlign: 'left' }}
                  aria-pressed={draft.categoryId === category.id}
                  onClick={() =>
                    patchDraft({ categoryId: category.id, categoryTouched: true })
                  }
                >
                  <span>{category.name}</span>
                  {draft.categoryId === category.id ? (
                    <span aria-hidden="true">✓</span>
                  ) : null}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowMore((value) => !value)}
            >
              {t('app.moreDetails')}
            </button>

            {showMore || settings.showAdvancedTransactionFields ? (
              <div className="stack">
                {funds.length > 0 ? (
                  <label className="field">
                    <span className="field__label">{t('expense.fund')}</span>
                    <select
                      className="field__control"
                      value={draft.fundId ?? ''}
                      onChange={(event) =>
                        patchDraft({ fundId: event.target.value || null })
                      }
                    >
                      <option value="">{t('expense.noCategory')}</option>
                      {funds
                        .filter((fund) => fund.isActive)
                        .map((fund) => (
                          <option key={fund.id} value={fund.id}>
                            {fund.name}
                          </option>
                        ))}
                    </select>
                  </label>
                ) : null}

                <label className="field">
                  <span className="field__label">{t('expense.treatment')}</span>
                  <select
                    className="field__control"
                    value={draft.treatmentId}
                    onChange={(event) => patchDraft({ treatmentId: event.target.value })}
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
                    value={draft.notes}
                    onChange={(event) => patchDraft({ notes: event.target.value })}
                  />
                </label>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="stack">
          {step === 'confirm' ? (
            <button
              type="button"
              className="primary-button"
              disabled={saving || !canContinue()}
              onClick={() => void persistExpense()}
            >
              {saving ? t('expense.saving') : t('expense.saveExpense')}
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              disabled={!canContinue() || saving}
              onClick={goNext}
            >
              {saving ? t('expense.saving') : t('app.continue')}
            </button>
          )}
          {stepIndex > 0 ? (
            <button type="button" className="secondary-button" onClick={goBack}>
              {t('app.back')}
            </button>
          ) : null}
        </div>
      </section>

      <UndoToast
        visible={undoVisible}
        onUndo={() => void handleUndo()}
        disabled={undoBusy}
      />
    </AppShell>
  )
}
