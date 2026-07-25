import { useEffect, useState } from 'react'
import { useAppState } from '@/app/appState'
import { THEME_PREFERENCES } from '@/domain/enums'
import type { ThemePreference } from '@/domain/enums'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t } from '@/i18n'
import { listCurrencies, listAccounts, listFunds, listTreatments, updateSettings } from '@/repositories'
import type { Account, Currency, Fund, Treatment } from '@/domain/types'

export function PreferencesSettingsScreen() {
  const { settings, refreshSettings } = useAppState()
  const [error, setError] = useState<string | null>(null)
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [funds, setFunds] = useState<Fund[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])

  const [baseCurrency, setBaseCurrency] = useState(settings?.baseCurrency ?? 'USD')
  const [theme, setTheme] = useState<ThemePreference>(settings?.themePreference ?? 'system')
  const [defaultAccountId, setDefaultAccountId] = useState(settings?.defaultAccountId ?? '')
  const [defaultFundId, setDefaultFundId] = useState(settings?.defaultFundId ?? '')
  const [defaultTreatmentId, setDefaultTreatmentId] = useState(
    settings?.defaultTreatmentId ?? '',
  )
  const [requireConfirmation, setRequireConfirmation] = useState(
    settings?.requireConfirmationBeforeSaving ?? true,
  )
  const [enableVoice, setEnableVoice] = useState(settings?.enableVoiceInput ?? true)
  const [enableSuggestions, setEnableSuggestions] = useState(
    settings?.enableSmartSuggestions ?? true,
  )
  const [showAdvanced, setShowAdvanced] = useState(
    settings?.showAdvancedTransactionFields ?? false,
  )

  useEffect(() => {
    void Promise.all([
      listCurrencies(true),
      listAccounts(),
      listFunds(),
      listTreatments(),
    ]).then(([c, a, f, tr]) => {
      setCurrencies(c)
      setAccounts(a)
      setFunds(f)
      setTreatments(tr.filter((item) => item.isActive))
    })
  }, [])

  useEffect(() => {
    if (!settings) return
    setBaseCurrency(settings.baseCurrency)
    setTheme(settings.themePreference)
    setDefaultAccountId(settings.defaultAccountId ?? '')
    setDefaultFundId(settings.defaultFundId ?? '')
    setDefaultTreatmentId(settings.defaultTreatmentId ?? '')
    setRequireConfirmation(settings.requireConfirmationBeforeSaving)
    setEnableVoice(settings.enableVoiceInput)
    setEnableSuggestions(settings.enableSmartSuggestions)
    setShowAdvanced(settings.showAdvancedTransactionFields)
  }, [settings])

  async function onSave() {
    setError(null)
    try {
      await updateSettings({
        baseCurrency,
        reportingCurrency: baseCurrency,
        themePreference: theme,
        defaultAccountId: defaultAccountId || null,
        defaultFundId: defaultFundId || null,
        defaultTreatmentId: defaultTreatmentId || null,
        requireConfirmationBeforeSaving: requireConfirmation,
        enableVoiceInput: enableVoice,
        enableSmartSuggestions: enableSuggestions,
        showAdvancedTransactionFields: showAdvanced,
      })
      await refreshSettings()
    } catch {
      setError(t('errors.generic'))
    }
  }

  return (
    <SettingsLayout
      title={t('settings.preferences')}
      heading={t('settings.preferences')}
      error={error}
    >
      <label className="field">
        <span className="field__label">{t('settings.baseCurrency')}</span>
        <select
          className="field__control"
          value={baseCurrency}
          onChange={(e) => setBaseCurrency(e.target.value)}
        >
          {currencies.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">{t('settings.theme')}</span>
        <select
          className="field__control"
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemePreference)}
        >
          {THEME_PREFERENCES.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">{t('settings.accounts')}</span>
        <select
          className="field__control"
          value={defaultAccountId}
          onChange={(e) => setDefaultAccountId(e.target.value)}
        >
          <option value="">—</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">{t('settings.funds')}</span>
        <select
          className="field__control"
          value={defaultFundId}
          onChange={(e) => setDefaultFundId(e.target.value)}
        >
          <option value="">—</option>
          {funds.map((fund) => (
            <option key={fund.id} value={fund.id}>
              {fund.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">{t('settings.treatments')}</span>
        <select
          className="field__control"
          value={defaultTreatmentId}
          onChange={(e) => setDefaultTreatmentId(e.target.value)}
        >
          <option value="">—</option>
          {treatments.map((treatment) => (
            <option key={treatment.id} value={treatment.id}>
              {treatment.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={requireConfirmation}
          onChange={(e) => setRequireConfirmation(e.target.checked)}
        />
        {t('settings.requireConfirmation')}
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={enableVoice}
          onChange={(e) => setEnableVoice(e.target.checked)}
        />
        {t('settings.enableVoice')}
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={enableSuggestions}
          onChange={(e) => setEnableSuggestions(e.target.checked)}
        />
        {t('settings.enableSuggestions')}
      </label>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={showAdvanced}
          onChange={(e) => setShowAdvanced(e.target.checked)}
        />
        {t('settings.showAdvanced')}
      </label>
      <button type="button" className="primary-button" onClick={() => void onSave()}>
        {t('app.save')}
      </button>
    </SettingsLayout>
  )
}
