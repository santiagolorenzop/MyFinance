import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { t } from '@/i18n'
import { fromMinorUnits, tryParsePositiveAmount } from '@/services/money'
import {
  deleteMovementFlow,
  duplicateMoneyEntryFlow,
  loadTransferCompanion,
  updateMoneyEntryFlow,
} from '@/services/movement'
import { listAccounts } from '@/repositories/accountsRepository'
import { listCategories } from '@/repositories/categoriesRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { getSettings } from '@/repositories/settingsRepository'
import { getTransaction } from '@/repositories/transactionsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import type {
  Account,
  Category,
  Currency,
  Transaction,
  Treatment,
  UserSettings,
} from '@/domain/types'

function typeLabel(type: Transaction['transactionType']): string {
  if (type === 'expense') return t('movements.types.expense')
  if (type === 'income') return t('movements.types.income')
  if (type === 'transfer') return t('movements.types.transfer')
  return t('movements.types.adjustment')
}

/**
 * Movement detail with tap-first edit / duplicate / delete.
 * Money rebuilds go through transaction engine helpers.
 */
export function TransactionDetailScreen() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [companion, setCompanion] = useState<Transaction | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [settings, setSettings] = useState<UserSettings | null>(null)

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [accountAmount, setAccountAmount] = useState('')
  const [date, setDate] = useState('')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [treatmentId, setTreatmentId] = useState('')
  const [notes, setNotes] = useState('')
  const [currencyCode, setCurrencyCode] = useState('')

  function applyTransactionToForm(
    tx: Transaction,
    nextCurrencies: Currency[],
  ) {
    const currency = nextCurrencies.find((row) => row.code === tx.originalCurrencyCode)
    const accountCurrency = nextCurrencies.find((row) => row.code === tx.accountCurrencyCode)
    setTitle(tx.title)
    setAmount(fromMinorUnits(tx.originalAmountMinor, currency?.decimalPlaces ?? 2))
    setAccountAmount(
      tx.originalCurrencyCode === tx.accountCurrencyCode
        ? ''
        : fromMinorUnits(tx.accountAmountMinor, accountCurrency?.decimalPlaces ?? 2),
    )
    setDate(tx.date)
    setAccountId(tx.accountId)
    setCategoryId(tx.categoryId)
    setTreatmentId(tx.treatmentId)
    setNotes(tx.notes ?? '')
    setCurrencyCode(tx.originalCurrencyCode)
  }

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!id) return
      try {
        const [tx, nextAccounts, nextCategories, nextCurrencies, nextTreatments, nextSettings] =
          await Promise.all([
            getTransaction(id),
            listAccounts(true),
            listCategories(true),
            listCurrencies(),
            listTreatments(),
            getSettings(),
          ])
        if (cancelled) return
        setAccounts(nextAccounts)
        setCategories(nextCategories)
        setCurrencies(nextCurrencies)
        setTreatments(nextTreatments.filter((row) => row.isActive))
        setSettings(nextSettings ?? null)

        if (!tx || tx.deletedAt != null) {
          setTransaction(null)
          return
        }

        setTransaction(tx)
        setCompanion(await loadTransferCompanion(tx))
        applyTransactionToForm(tx, nextCurrencies)
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

  const currencyByCode = useMemo(() => {
    const map: Record<string, Currency> = {}
    for (const currency of currencies) map[currency.code] = currency
    return map
  }, [currencies])

  const accountById = useMemo(() => {
    const map = new Map(accounts.map((row) => [row.id, row]))
    return map
  }, [accounts])

  const editable =
    transaction?.transactionType === 'expense' || transaction?.transactionType === 'income'

  async function onSaveEdit() {
    if (!transaction || !settings || !editable) return
    const selectedAccount = accountById.get(accountId)
    if (!selectedAccount) {
      setError(t('errors.selectAccount'))
      return
    }

    const originalAmountMinor = tryParsePositiveAmount(
      amount,
      currencyByCode[currencyCode]?.decimalPlaces ?? 2,
    )
    if (originalAmountMinor == null) {
      setError(t('errors.invalidAmount'))
      return
    }

    const needsAccountAmount = currencyCode !== selectedAccount.currencyCode
    let accountAmountMinor: number | null = null
    if (needsAccountAmount) {
      accountAmountMinor = tryParsePositiveAmount(
        accountAmount,
        currencyByCode[selectedAccount.currencyCode]?.decimalPlaces ?? 2,
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

    setSaving(true)
    setError(null)
    const result = await updateMoneyEntryFlow(transaction.id, {
      date,
      title,
      notes: notes.trim() || null,
      accountId,
      categoryId,
      fundId: transaction.fundId,
      treatmentId,
      originalAmountMinor,
      originalCurrencyCode: currencyCode,
      accountCurrencyCode: selectedAccount.currencyCode,
      baseCurrencyCode: settings.baseCurrency,
      accountAmountMinor,
      currencies: currencyMap,
      createdAt: transaction.createdAt,
      updatedAt: new Date().toISOString(),
    })
    setSaving(false)

    if (!result.ok) {
      setError(result.error || t('movements.updateFailed'))
      return
    }
    setEditing(false)
    setMessage(null)
    setTransaction(result.transaction)
    applyTransactionToForm(result.transaction, currencies)
  }

  async function onDelete() {
    if (!transaction) return
    const confirmed = window.confirm(t('movements.deleteConfirm'))
    if (!confirmed) return
    setSaving(true)
    setError(null)
    const result = await deleteMovementFlow(transaction.id)
    setSaving(false)
    if (!result.ok) {
      setError(t('movements.deleteFailed'))
      return
    }
    navigate('/transactions')
  }

  async function onDuplicate() {
    if (!transaction) return
    setSaving(true)
    setError(null)
    const result = await duplicateMoneyEntryFlow(transaction.id)
    setSaving(false)
    if (!result.ok) {
      setError(result.error || t('movements.duplicateFailed'))
      return
    }
    navigate(`/transactions/${result.transaction.id}`)
  }

  if (loading) {
    return (
      <AppShell title={t('movements.detail')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (!transaction) {
    return (
      <AppShell title={t('movements.detail')}>
        <section className="screen">
          <p className="screen__note">{t('movements.notFound')}</p>
          <Link className="primary-button" to="/transactions">
            {t('app.back')}
          </Link>
        </section>
      </AppShell>
    )
  }

  const displayCurrency = currencyByCode[transaction.originalCurrencyCode]
  const amountLabel = fromMinorUnits(
    transaction.originalAmountMinor,
    displayCurrency?.decimalPlaces ?? 2,
  )

  return (
    <AppShell title={t('movements.detail')}>
      <section className="screen">
        <div className="stack">
          <h2 className="screen__heading">{transaction.title}</h2>
          <p className="screen__subheading">
            {amountLabel} {transaction.originalCurrencyCode} ·{' '}
            {typeLabel(transaction.transactionType)}
          </p>
          <p className="screen__note">
            {transaction.date} · {accountById.get(transaction.accountId)?.name}
          </p>
        </div>

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

        {companion ? (
          <p className="screen__note">
            {t('movements.transferPair')}: {companion.accountId === transaction.accountId
              ? companion.id
              : accountById.get(companion.accountId)?.name}{' '}
            ({fromMinorUnits(
              companion.originalAmountMinor,
              currencyByCode[companion.originalCurrencyCode]?.decimalPlaces ?? 2,
            )}{' '}
            {companion.originalCurrencyCode})
          </p>
        ) : null}

        {editing && editable ? (
          <div className="stack">
            <label className="field">
              <span className="field__label">{t('transfer.title')}</span>
              <input
                className="field__control"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="field">
              <span className="field__label">{t('expense.stepAmount')}</span>
              <input
                className="field__control"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
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
              <span className="field__label">{t('movements.account')}</span>
              <select
                className="field__control"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                {accounts
                  .filter((row) => row.archivedAt == null)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span className="field__label">{t('movements.category')}</span>
              <select
                className="field__control"
                value={categoryId ?? ''}
                onChange={(event) => setCategoryId(event.target.value || null)}
              >
                <option value="">{t('expense.noCategory')}</option>
                {categories
                  .filter((row) => row.archivedAt == null)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            {currencyCode !== accountById.get(accountId)?.currencyCode ? (
              <label className="field">
                <span className="field__label">{t('expense.accountAmount')}</span>
                <input
                  className="field__control"
                  inputMode="decimal"
                  value={accountAmount}
                  onChange={(event) => setAccountAmount(event.target.value)}
                />
              </label>
            ) : null}
            <label className="field">
              <span className="field__label">{t('expense.treatment')}</span>
              <select
                className="field__control"
                value={treatmentId}
                onChange={(event) => setTreatmentId(event.target.value)}
              >
                {treatments
                  .filter((row) => !row.isTransferBehavior)
                  .map((treatment) => (
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
            <button
              type="button"
              className="primary-button"
              disabled={saving}
              onClick={() => void onSaveEdit()}
            >
              {saving ? t('expense.saving') : t('movements.saveChanges')}
            </button>
            <button type="button" className="secondary-button" onClick={() => setEditing(false)}>
              {t('app.cancel')}
            </button>
          </div>
        ) : (
          <div className="stack">
            {transaction.notes ? <p className="screen__note">{transaction.notes}</p> : null}
            <div className="inline-actions">
              {editable ? (
                <button type="button" className="secondary-button" onClick={() => setEditing(true)}>
                  {t('app.edit')}
                </button>
              ) : null}
              {transaction.transactionType === 'transfer' && transaction.linkedTransferId ? (
                <Link
                  className="secondary-button"
                  to={`/add-transfer?transferId=${transaction.linkedTransferId}`}
                >
                  {t('app.edit')}
                </Link>
              ) : null}
              {editable ? (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={saving}
                  onClick={() => void onDuplicate()}
                >
                  {t('app.duplicate')}
                </button>
              ) : null}
              <button
                type="button"
                className="danger-button"
                disabled={saving}
                onClick={() => void onDelete()}
              >
                {t('app.delete')}
              </button>
            </div>
            <Link className="secondary-button" to="/transactions">
              {t('app.back')}
            </Link>
          </div>
        )}
      </section>
    </AppShell>
  )
}
