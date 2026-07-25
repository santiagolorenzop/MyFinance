import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '@/app/appState'
import { ACCOUNT_TYPES } from '@/domain/enums'
import type { AccountType } from '@/domain/enums'
import { AppShell } from '@/components/ui/AppShell'
import { t, type TranslationKey } from '@/i18n'
import {
  ASSIGNABLE_CATEGORY_KINDS,
  type AssignableCategoryKind,
} from '@/services/category'
import { parseUserAmountInput } from '@/services/money'
import {
  createAccount,
  createBudgetPlan,
  createCategoriesFromTemplate,
  createCategory,
  createFund,
  listCurrencies,
  updateSettings,
} from '@/repositories'
import { todayFinancialDate } from '@/utils/dates'
import type { Currency } from '@/domain/types'

type Step =
  | 'welcome'
  | 'baseCurrency'
  | 'period'
  | 'accounts'
  | 'categories'
  | 'budget'
  | 'advanced'
  | 'finish'

export function OnboardingScreen() {
  const navigate = useNavigate()
  const { refreshSettings, settings } = useAppState()
  const [step, setStep] = useState<Step>('welcome')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])

  const [baseCurrency, setBaseCurrency] = useState(settings?.baseCurrency ?? 'USD')
  const [periodDay, setPeriodDay] = useState(settings?.financialPeriodStartDay ?? 1)

  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<AccountType>('checking')
  const [accountCurrency, setAccountCurrency] = useState(settings?.baseCurrency ?? 'USD')
  const [accountBalance, setAccountBalance] = useState('0')
  const [accountsAdded, setAccountsAdded] = useState(0)

  const [categoryName, setCategoryName] = useState('')
  const [categoryKind, setCategoryKind] = useState<AssignableCategoryKind>('expense')
  const [categoriesAdded, setCategoriesAdded] = useState(0)
  const [categories, setCategories] = useState<
    Array<{ id: string; name: string; kind: AssignableCategoryKind }>
  >([])

  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, string>>({})
  const [enableFunds, setEnableFunds] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    void listCurrencies(true).then(setCurrencies)
  }, [])

  function clearError() {
    setError(null)
  }

  async function saveBaseAndPeriod() {
    setBusy(true)
    clearError()
    try {
      await updateSettings({
        baseCurrency,
        financialPeriodStartDay: periodDay,
      })
      await refreshSettings()
      setAccountCurrency(baseCurrency)
      setStep('accounts')
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function addAccount() {
    clearError()
    if (!accountName.trim()) {
      setError(t('errors.requiredName'))
      return
    }
    const currency = currencies.find((c) => c.code === accountCurrency)
    try {
      const minor = parseUserAmountInput(
        accountBalance || '0',
        currency?.decimalPlaces ?? 2,
      )
      await createAccount({
        name: accountName,
        type: accountType,
        currencyCode: accountCurrency,
        initialBalanceMinor: minor,
        isDefault: accountsAdded === 0,
      })
      setAccountsAdded((n) => n + 1)
      setAccountName('')
      setAccountBalance('0')
    } catch {
      setError(t('errors.invalidAmount'))
    }
  }

  async function addCategory() {
    clearError()
    if (!categoryName.trim()) {
      setError(t('errors.requiredName'))
      return
    }
    try {
      const created = await createCategory({ name: categoryName, kind: categoryKind })
      setCategories((rows) => [
        ...rows,
        { id: created.id, name: created.name, kind: categoryKind },
      ])
      setCategoriesAdded((n) => n + 1)
      setCategoryName('')
    } catch {
      setError(t('errors.generic'))
    }
  }

  async function applyCategoryTemplate() {
    clearError()
    setBusy(true)
    try {
      const created = await createCategoriesFromTemplate()
      setCategories(
        created.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind === 'income' ? 'income' : 'expense',
        })),
      )
      setCategoriesAdded(created.length)
      setStep('budget')
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function saveBudget(skip: boolean) {
    clearError()
    setBusy(true)
    try {
      const expenseCategories = categories.filter((row) => row.kind === 'expense')
      if (!skip && expenseCategories.length > 0) {
        const currency = currencies.find((c) => c.code === baseCurrency)
        const allocations = expenseCategories
          .map((category) => {
            const raw = budgetAmounts[category.id] ?? '0'
            const minor = parseUserAmountInput(raw || '0', currency?.decimalPlaces ?? 2)
            return { categoryId: category.id, allocatedAmountMinor: minor }
          })
          .filter((row) => row.allocatedAmountMinor > 0)

        if (allocations.length > 0) {
          await createBudgetPlan({
            name: 'Monthly budget',
            baseCurrencyCode: baseCurrency,
            effectiveFrom: todayFinancialDate(),
            allocations,
          })
        }
      }
      setStep('advanced')
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function saveAdvanced() {
    clearError()
    setBusy(true)
    try {
      if (enableFunds) {
        await createFund({
          name: 'Monthly',
          isDefault: true,
          currencyCode: baseCurrency,
        })
      }
      await updateSettings({
        showAdvancedTransactionFields: showAdvanced || enableFunds,
      })
      await refreshSettings()
      setStep('finish')
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  async function completeOnboarding() {
    setBusy(true)
    clearError()
    try {
      await updateSettings({ onboardingCompleted: true })
      await refreshSettings()
      navigate('/', { replace: true })
    } catch {
      setError(t('errors.generic'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell showMenu={false}>
      <section className="screen">
        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        {step === 'welcome' ? (
          <>
            <div className="stack">
              <h2 className="screen__heading">{t('onboarding.welcomeTitle')}</h2>
              <p className="screen__subheading">{t('onboarding.welcomeBody')}</p>
            </div>
            <button type="button" className="primary-button" onClick={() => setStep('baseCurrency')}>
              {t('onboarding.getStarted')}
            </button>
          </>
        ) : null}

        {step === 'baseCurrency' ? (
          <>
            <div className="stack">
              <h2 className="screen__heading">{t('onboarding.baseCurrencyTitle')}</h2>
              <p className="screen__subheading">{t('onboarding.baseCurrencyBody')}</p>
            </div>
            <label className="field">
              <span className="field__label">{t('settings.baseCurrency')}</span>
              <select
                className="field__control"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => setStep('period')}
            >
              {t('app.continue')}
            </button>
          </>
        ) : null}

        {step === 'period' ? (
          <>
            <div className="stack">
              <h2 className="screen__heading">{t('onboarding.periodTitle')}</h2>
              <p className="screen__subheading">{t('onboarding.periodBody')}</p>
            </div>
            <label className="field">
              <span className="field__label">{t('settings.periodStartDay')}</span>
              <input
                className="field__control"
                type="number"
                min={1}
                max={31}
                value={periodDay}
                onChange={(e) => setPeriodDay(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => {
                if (!Number.isInteger(periodDay) || periodDay < 1 || periodDay > 31) {
                  setError(t('errors.generic'))
                  return
                }
                void saveBaseAndPeriod()
              }}
            >
              {t('app.continue')}
            </button>
          </>
        ) : null}

        {step === 'accounts' ? (
          <>
            <div className="stack">
              <h2 className="screen__heading">{t('onboarding.accountsTitle')}</h2>
              <p className="screen__subheading">{t('onboarding.accountsBody')}</p>
              <p className="screen__note">
                {accountsAdded} {t('settings.accounts').toLowerCase()}
              </p>
            </div>
            <label className="field">
              <span className="field__label">{t('settings.name')}</span>
              <input
                className="field__control"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">{t('settings.type')}</span>
              <select
                className="field__control"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as AccountType)}
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {t(`accountTypes.${type}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">{t('settings.currency')}</span>
              <select
                className="field__control"
                value={accountCurrency}
                onChange={(e) => setAccountCurrency(e.target.value)}
              >
                {currencies.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">{t('settings.initialBalance')}</span>
              <input
                className="field__control"
                inputMode="decimal"
                value={accountBalance}
                onChange={(e) => setAccountBalance(e.target.value)}
              />
            </label>
            <div className="inline-actions">
              <button type="button" className="secondary-button" onClick={() => void addAccount()}>
                {t('onboarding.addAnotherAccount')}
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={accountsAdded < 1}
                onClick={() => {
                  if (accountsAdded < 1) {
                    setError(t('onboarding.needAccount'))
                    return
                  }
                  setStep('categories')
                }}
              >
                {t('app.continue')}
              </button>
            </div>
          </>
        ) : null}

        {step === 'categories' ? (
          <>
            <div className="stack">
              <h2 className="screen__heading">{t('onboarding.categoriesTitle')}</h2>
              <p className="screen__subheading">{t('onboarding.categoriesBody')}</p>
              <p className="screen__note">
                {categoriesAdded} {t('settings.categories').toLowerCase()}
              </p>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void applyCategoryTemplate()}
            >
              {t('onboarding.useTemplate')}
            </button>
            <label className="field">
              <span className="field__label">{t('settings.name')}</span>
              <input
                className="field__control"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder={t('onboarding.buildScratch')}
              />
            </label>
            <label className="field">
              <span className="field__label">{t('settings.kind')}</span>
              <select
                className="field__control"
                value={categoryKind}
                onChange={(e) =>
                  setCategoryKind(e.target.value as AssignableCategoryKind)
                }
              >
                {ASSIGNABLE_CATEGORY_KINDS.map((item) => (
                  <option key={item} value={item}>
                    {t(`categoryKinds.${item}` as TranslationKey)}
                  </option>
                ))}
              </select>
            </label>
            <div className="inline-actions">
              <button type="button" className="secondary-button" onClick={() => void addCategory()}>
                {t('onboarding.addCategory')}
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={() => setStep('budget')}
              >
                {t('app.continue')}
              </button>
            </div>
          </>
        ) : null}

        {step === 'budget' ? (
          <>
            <div className="stack">
              <h2 className="screen__heading">{t('onboarding.budgetTitle')}</h2>
              <p className="screen__subheading">{t('onboarding.budgetBody')}</p>
            </div>
            {categories.filter((row) => row.kind === 'expense').length === 0 ? (
              <p className="screen__note">{t('settings.noCategoriesForBudget')}</p>
            ) : (
              <div className="stack">
                {categories
                  .filter((row) => row.kind === 'expense')
                  .map((category) => (
                    <label key={category.id} className="field">
                      <span className="field__label">
                        {category.name} ({baseCurrency})
                      </span>
                      <input
                        className="field__control"
                        inputMode="decimal"
                        value={budgetAmounts[category.id] ?? ''}
                        onChange={(e) =>
                          setBudgetAmounts((prev) => ({
                            ...prev,
                            [category.id]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
              </div>
            )}
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void saveBudget(false)}
            >
              {t('app.continue')}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => void saveBudget(true)}
            >
              {t('onboarding.skipBudget')}
            </button>
          </>
        ) : null}

        {step === 'advanced' ? (
          <>
            <div className="stack">
              <h2 className="screen__heading">{t('onboarding.advancedTitle')}</h2>
              <p className="screen__subheading">{t('onboarding.advancedBody')}</p>
            </div>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={enableFunds}
                onChange={(e) => setEnableFunds(e.target.checked)}
              />
              {t('onboarding.enableFunds')}
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={showAdvanced}
                onChange={(e) => setShowAdvanced(e.target.checked)}
              />
              {t('settings.showAdvanced')}
            </label>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void saveAdvanced()}
            >
              {t('app.continue')}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={busy}
              onClick={() => setStep('finish')}
            >
              {t('app.skip')}
            </button>
          </>
        ) : null}

        {step === 'finish' ? (
          <>
            <div className="stack">
              <h2 className="screen__heading">{t('onboarding.finishTitle')}</h2>
              <p className="screen__subheading">{t('onboarding.finishBody')}</p>
            </div>
            <button
              type="button"
              className="primary-button"
              disabled={busy}
              onClick={() => void completeOnboarding()}
            >
              {t('onboarding.finish')}
            </button>
          </>
        ) : null}
      </section>
    </AppShell>
  )
}
