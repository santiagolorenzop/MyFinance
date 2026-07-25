import { useCallback, useEffect, useState } from 'react'
import { DebtAmountField } from '@/components/forms/DebtAmountField'
import { signedMinorFromDebtInput } from '@/services/account/debtAmount'
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

function supportsDebtBalance(type: AccountType): boolean {
  return type === 'credit_card' || type === 'loan'
}

export function AccountsSettingsScreen() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<AccountType>('checking')
  const [currencyCode, setCurrencyCode] = useState('USD')
  const [balance, setBalance] = useState('0')
  const [isDebt, setIsDebt] = useState(false)
  const [includeInTotal, setIncludeInTotal] = useState(true)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editType, setEditType] = useState<AccountType>('checking')
  const [editCurrencyCode, setEditCurrencyCode] = useState('USD')
  const [editBalance, setEditBalance] = useState('0')
  const [editIsDebt, setEditIsDebt] = useState(false)
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
    const absMinor = Math.abs(account.initialBalanceMinor)
    setEditBalance(fromMinorUnits(absMinor, currency?.decimalPlaces ?? 2))
    setEditIsDebt(
      supportsDebtBalance(account.type) ? account.initialBalanceMinor < 0 : false,
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
      const debtMode = supportsDebtBalance(type)
      await createAccount({
        name,
        type,
        currencyCode,
        initialBalanceMinor: signedMinorFromDebtInput(
          balance || '0',
          currency?.decimalPlaces ?? 2,
          debtMode && isDebt,
          parseUserAmountInput,
        ),
        includeInTotalNetBalance: includeInTotal,
      })
      setName('')
      setBalance('0')
      setIsDebt(false)
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
      const debtMode = supportsDebtBalance(editType)
      const result = await updateAccount(editingId, {
        name: editName,
        type: editType,
        currencyCode: editCurrencyCode,
        initialBalanceMinor: signedMinorFromDebtInput(
          editBalance || '0',
          currency?.decimalPlaces ?? 2,
          debtMode && editIsDebt,
          parseUserAmountInput,
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
                      <DebtAmountField
                        label={t('settings.initialBalance')}
                        value={editBalance}
                        onChange={setEditBalance}
                        enableDebtMode={supportsDebtBalance(editType)}
                        isDebt={editIsDebt}
                        onDebtChange={setEditIsDebt}
                        hint={
                          supportsDebtBalance(editType)
                            ? t('settings.creditDebtHint')
                            : t('settings.initialBalanceChangeHint')
                        }
                      />
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
            onChange={(e) => {
              const next = e.target.value as AccountType
              setType(next)
              if (supportsDebtBalance(next)) setIsDebt(true)
              else setIsDebt(false)
            }}
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
        <DebtAmountField
          label={t('settings.initialBalance')}
          value={balance}
          onChange={setBalance}
          enableDebtMode={supportsDebtBalance(type)}
          isDebt={isDebt}
          onDebtChange={setIsDebt}
          hint={
            supportsDebtBalance(type) ? t('settings.creditDebtHint') : undefined
          }
        />
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
