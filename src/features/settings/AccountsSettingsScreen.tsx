import { useCallback, useEffect, useState } from 'react'
import { ACCOUNT_TYPES } from '@/domain/enums'
import type { AccountType } from '@/domain/enums'
import type { Account, Currency } from '@/domain/types'
import { SettingsLayout } from '@/features/settings/SettingsLayout'
import { t, type TranslationKey } from '@/i18n'
import { fromMinorUnits, parseUserAmountInput } from '@/services/money'
import {
  IntegrityError,
  archiveAccount,
  createAccount,
  deleteAccount,
  listAccounts,
  listCurrencies,
  updateAccount,
} from '@/repositories'

export function AccountsSettingsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [balance, setBalance] = useState('0')
  const [includeInTotal, setIncludeInTotal] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<AccountType>('checking')
  const [editCurrencyCode, setEditCurrencyCode] = useState('USD')
  const [editBalance, setEditBalance] = useState('0')
  const [editIncludeInTotal, setEditIncludeInTotal] = useState(true)
  const [editActive, setEditActive] = useState(true)

  const reload = useCallback(async () => {
    setAccounts(await listAccounts())
    setCurrencies(await listCurrencies(true))
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  function startEdit(account: Account) {
    setError(null)
    setWarning(null)
    setEditingId(account.id)
    setEditName(account.name)
    setEditType(account.type)
    setEditCurrencyCode(account.currencyCode)
    const currency = currencies.find((c) => c.code === account.currencyCode)
    setEditBalance(
      fromMinorUnits(account.initialBalanceMinor, currency?.decimalPlaces ?? 2),
    )
    setEditIncludeInTotal(account.includeInTotalNetBalance)
    setEditActive(account.isActive)
  }

  function cancelEdit() {
    setEditingId(null)
    setWarning(null)
  }

  async function onAdd() {
    setError(null)
    setWarning(null)
    if (!name.trim()) {
      setError(t('errors.requiredName'))
      return
    }
    try {
      const currency = currencies.find((c) => c.code === currencyCode)
      await createAccount({
        name,
        type,
        currencyCode,
        initialBalanceMinor: parseUserAmountInput(
          balance || '0',
          currency?.decimalPlaces ?? 2,
        ),
        includeInTotalNetBalance: includeInTotal,
      })
      setName('')
      setBalance('0')
      setIncludeInTotal(true)
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('errors.generic'))
    }
  }

  async function onSaveEdit() {
    if (!editingId) return
    setError(null)
    setWarning(null)
    if (!editName.trim()) {
      setError(t('errors.requiredName'))
      return
    }
    try {
      const currency = currencies.find((c) => c.code === editCurrencyCode)
      const result = await updateAccount(editingId, {
        name: editName,
        type: editType,
        currencyCode: editCurrencyCode,
        initialBalanceMinor: parseUserAmountInput(
          editBalance || '0',
          currency?.decimalPlaces ?? 2,
        ),
        includeInTotalNetBalance: editIncludeInTotal,
        isActive: editActive,
      })
      if (result.warnings.length > 0) {
        setWarning(result.warnings.join(' '))
      }
      setEditingId(null)
      await reload()
    } catch (cause) {
      setError(
        cause instanceof IntegrityError || cause instanceof Error
          ? cause.message
          : t('errors.generic'),
      )
    }
  }

  async function onArchive(id: string) {
    setError(null)
    if (!window.confirm(t('settings.archiveConfirm'))) return
    try {
      await archiveAccount(id)
      if (editingId === id) cancelEdit()
      await reload()
    } catch {
      setError(t('errors.generic'))
    }
  }

  async function onDelete(id: string) {
    setError(null)
    try {
      await deleteAccount(id)
      if (editingId === id) cancelEdit()
      await reload()
    } catch (cause) {
      setError(
        cause instanceof IntegrityError
          ? cause.message
          : t('settings.cannotDeleteHasHistory'),
      )
    }
  }

  return (
    <SettingsLayout
      title={t('settings.accounts')}
      heading={t('settings.accounts')}
      error={error}
    >
      {warning ? (
        <p className="screen__note" role="status">
          {warning}
        </p>
      ) : null}

      <div className="stack">
        {accounts.length === 0 ? (
          <p className="screen__note">{t('settings.emptyList')}</p>
        ) : (
          accounts.map((account) => {
            const currency = currencies.find((c) => c.code === account.currencyCode)
            const isEditing = editingId === account.id
            return (
              <div key={account.id} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div className="stack" style={{ gap: '4px', width: '100%' }}>
                  {isEditing ? (
                    <>
                      <label className="field">
                        <span className="field__label">{t('settings.name')}</span>
                        <input
                          className="field__control"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span className="field__label">{t('settings.type')}</span>
                        <select
                          className="field__control"
                          value={editType}
                          onChange={(e) => setEditType(e.target.value as AccountType)}
                        >
                          {ACCOUNT_TYPES.map((item) => (
                            <option key={item} value={item}>
                              {t(`accountTypes.${item}` as TranslationKey)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="field">
                        <span className="field__label">{t('settings.currency')}</span>
                        <select
                          className="field__control"
                          value={editCurrencyCode}
                          onChange={(e) => setEditCurrencyCode(e.target.value)}
                        >
                          {currencies.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.code}
                            </option>
                          ))}
                        </select>
                      </label>
                      <p className="screen__note">{t('settings.currencyChangeHint')}</p>
                      <label className="field">
                        <span className="field__label">{t('settings.initialBalance')}</span>
                        <input
                          className="field__control"
                          inputMode="decimal"
                          value={editBalance}
                          onChange={(e) => setEditBalance(e.target.value)}
                        />
                      </label>
                      <p className="screen__note">{t('settings.initialBalanceChangeHint')}</p>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={editIncludeInTotal}
                          onChange={(e) => setEditIncludeInTotal(e.target.checked)}
                        />
                        <span>{t('settings.includeInTotal')}</span>
                      </label>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                        />
                        <span>{t('settings.active')}</span>
                      </label>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void onSaveEdit()}
                        >
                          {t('app.save')}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={cancelEdit}
                        >
                          {t('app.cancel')}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <strong>
                        {account.name}
                        {account.isDefault ? ` (${t('settings.default')})` : ''}
                      </strong>
                      <span className="screen__note">
                        {t(`accountTypes.${account.type}` as TranslationKey)} ·{' '}
                        {account.currencyCode} ·{' '}
                        {fromMinorUnits(
                          account.initialBalanceMinor,
                          currency?.decimalPlaces ?? 2,
                        )}
                        {!account.includeInTotalNetBalance
                          ? ` · ${t('balances.excludedFromTotal')}`
                          : ''}
                        {!account.isActive ? ` · ${t('settings.inactive')}` : ''}
                      </span>
                      <div className="inline-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => startEdit(account)}
                        >
                          {t('app.edit')}
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void onArchive(account.id)}
                        >
                          {t('app.archive')}
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => void onDelete(account.id)}
                        >
                          {t('app.delete')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="stack skeleton-block">
        <label className="field">
          <span className="field__label">{t('settings.name')}</span>
          <input className="field__control" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field__label">{t('settings.type')}</span>
          <select
            className="field__control"
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
          >
            {ACCOUNT_TYPES.map((item) => (
              <option key={item} value={item}>
                {t(`accountTypes.${item}` as TranslationKey)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">{t('settings.currency')}</span>
          <select
            className="field__control"
            value={currencyCode}
            onChange={(e) => setCurrencyCode(e.target.value)}
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
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
          />
        </label>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={includeInTotal}
            onChange={(e) => setIncludeInTotal(e.target.checked)}
          />
          <span>{t('settings.includeInTotal')}</span>
        </label>
        <button type="button" className="primary-button" onClick={() => void onAdd()}>
          {t('app.add')}
        </button>
      </div>
    </SettingsLayout>
  )
}
