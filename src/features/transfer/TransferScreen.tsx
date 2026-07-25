import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AppShell } from '@/components/ui/AppShell'
import { t } from '@/i18n'
import { fromMinorUnits, tryParsePositiveAmount } from '@/services/money'
import { saveTransferFlow, updateTransferFlow } from '@/services/transfer'
import { getTransferLegsFromLedger } from '@/services/transfer/transferService'
import { listAccounts } from '@/repositories/accountsRepository'
import { getSettings } from '@/repositories/settingsRepository'
import { listTreatments } from '@/repositories/treatmentsRepository'
import { listCurrencies } from '@/repositories/currenciesRepository'
import { listTransactionsByTransferId } from '@/repositories/transactionsRepository'
import type { Account, Currency } from '@/domain/types'
import { todayFinancialDate } from '@/utils/dates'

/**
 * Dedicated transfer flow — builds both ledger legs via transferService.
 */
export function TransferScreen() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editTransferId = params.get('transferId')

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currencies, setCurrencies] = useState<Currency[]>([])
  const [transferTreatmentId, setTransferTreatmentId] = useState('')

  const [sourceAccountId, setSourceAccountId] = useState('')
  const [destinationAccountId, setDestinationAccountId] = useState('')
  const [sourceAmount, setSourceAmount] = useState('')
  const [destinationAmount, setDestinationAmount] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayFinancialDate())
  const [notes, setNotes] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const [nextSettings, nextAccounts, nextTreatments, nextCurrencies] = await Promise.all([
          getSettings(),
          listAccounts(),
          listTreatments(),
          listCurrencies(true),
        ])
        if (cancelled) return

        setAccounts(nextAccounts)
        setCurrencies(nextCurrencies)

        const transferTreatment =
          nextTreatments.find((row) => row.behaviorKey === 'internal_transfer')?.id ?? ''
        setTransferTreatmentId(transferTreatment)

        const defaultSource =
          nextSettings?.defaultAccountId ??
          nextAccounts.find((row) => row.isDefault)?.id ??
          nextAccounts[0]?.id ??
          ''
        const defaultDest =
          nextAccounts.find((row) => row.id !== defaultSource)?.id ?? nextAccounts[1]?.id ?? ''

        if (editTransferId) {
          const legs = await listTransactionsByTransferId(editTransferId)
          const pair = getTransferLegsFromLedger(legs, editTransferId)
          if (!pair) {
            setError(t('movements.notFound'))
            setSourceAccountId(defaultSource)
            setDestinationAccountId(defaultDest)
          } else {
            const sourceDp =
              nextCurrencies.find((c) => c.code === pair.outgoing.originalCurrencyCode)
                ?.decimalPlaces ?? 2
            const destDp =
              nextCurrencies.find((c) => c.code === pair.incoming.originalCurrencyCode)
                ?.decimalPlaces ?? 2
            setSourceAccountId(pair.outgoing.accountId)
            setDestinationAccountId(pair.incoming.accountId)
            setSourceAmount(fromMinorUnits(pair.outgoing.originalAmountMinor, sourceDp))
            setDestinationAmount(fromMinorUnits(pair.incoming.originalAmountMinor, destDp))
            setTitle(pair.outgoing.title === 'Transfer' ? '' : pair.outgoing.title)
            setDate(pair.outgoing.date)
            setNotes(pair.outgoing.notes ?? '')
            setTransferTreatmentId(pair.outgoing.treatmentId)
          }
        } else {
          setSourceAccountId(defaultSource)
          setDestinationAccountId(defaultDest)
        }
      } catch {
        if (!cancelled) setError(t('errors.generic'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editTransferId])

  const currencyByCode = useMemo(() => {
    const map: Record<string, Currency> = {}
    for (const currency of currencies) map[currency.code] = currency
    return map
  }, [currencies])

  const sourceAccount = accounts.find((row) => row.id === sourceAccountId) ?? null
  const destinationAccount = accounts.find((row) => row.id === destinationAccountId) ?? null
  const crossCurrency =
    Boolean(sourceAccount && destinationAccount) &&
    sourceAccount!.currencyCode !== destinationAccount!.currencyCode

  async function onSave() {
    if (!sourceAccount || !destinationAccount || saving) return
    if (sourceAccountId === destinationAccountId) {
      setError(t('transfer.sameAccount'))
      return
    }
    if (!transferTreatmentId) {
      setError(t('errors.generic'))
      return
    }

    const sourceAmountMinor = tryParsePositiveAmount(
      sourceAmount,
      currencyByCode[sourceAccount.currencyCode]?.decimalPlaces ?? 2,
    )
    if (sourceAmountMinor == null) {
      setError(t('errors.invalidAmount'))
      return
    }

    let destinationAmountMinor = sourceAmountMinor
    if (crossCurrency) {
      const parsed = tryParsePositiveAmount(
        destinationAmount,
        currencyByCode[destinationAccount.currencyCode]?.decimalPlaces ?? 2,
      )
      if (parsed == null) {
        setError(t('errors.invalidAmount'))
        return
      }
      destinationAmountMinor = parsed
    }

    const now = new Date().toISOString()
    setSaving(true)
    setError(null)

    const draft = {
      transferId: editTransferId ?? crypto.randomUUID(),
      date,
      title: title.trim() || 'Transfer',
      notes: notes.trim() || null,
      sourceAccountId,
      destinationAccountId,
      sourceAmountMinor,
      sourceCurrencyCode: sourceAccount.currencyCode,
      destinationAmountMinor,
      destinationCurrencyCode: destinationAccount.currencyCode,
      treatmentId: transferTreatmentId,
      createdAt: now,
      updatedAt: now,
    }

    const result = editTransferId
      ? await updateTransferFlow(draft)
      : await saveTransferFlow(draft)

    setSaving(false)
    if (!result.ok) {
      setError(result.error || t('transfer.saveFailed'))
      return
    }
    navigate('/transactions')
  }

  if (loading) {
    return (
      <AppShell title={t('transfer.heading')}>
        <section className="screen">
          <p className="screen__subheading">{t('app.loading')}</p>
        </section>
      </AppShell>
    )
  }

  if (accounts.length < 2) {
    return (
      <AppShell title={t('transfer.heading')}>
        <section className="screen">
          <p className="screen__note">{t('transfer.needTwoAccounts')}</p>
          <Link className="primary-button" to="/settings/accounts">
            {t('expense.goToAccounts')}
          </Link>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell title={editTransferId ? t('transfer.editHeading') : t('transfer.heading')}>
      <section className="screen">
        <h2 className="screen__heading">
          {editTransferId ? t('transfer.editHeading') : t('transfer.heading')}
        </h2>

        {error ? (
          <p className="field__error" role="alert">
            {error}
          </p>
        ) : null}

        <label className="field">
          <span className="field__label">{t('transfer.from')}</span>
          <select
            className="field__control"
            value={sourceAccountId}
            onChange={(event) => setSourceAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currencyCode})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">{t('transfer.to')}</span>
          <select
            className="field__control"
            value={destinationAccountId}
            onChange={(event) => setDestinationAccountId(event.target.value)}
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name} ({account.currencyCode})
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span className="field__label">{t('transfer.amountFrom')}</span>
          <input
            className="field__control"
            inputMode="decimal"
            value={sourceAmount}
            onChange={(event) => setSourceAmount(event.target.value)}
            placeholder={sourceAccount?.currencyCode}
          />
        </label>

        {crossCurrency ? (
          <label className="field">
            <span className="field__label">{t('transfer.amountTo')}</span>
            <span className="screen__note">{t('transfer.amountToHint')}</span>
            <input
              className="field__control"
              inputMode="decimal"
              value={destinationAmount}
              onChange={(event) => setDestinationAmount(event.target.value)}
              placeholder={destinationAccount?.currencyCode}
            />
          </label>
        ) : null}

        <label className="field">
          <span className="field__label">{t('transfer.title')}</span>
          <input
            className="field__control"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('transfer.titlePlaceholder')}
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
          <span className="field__label">{t('expense.notes')}</span>
          <input
            className="field__control"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <div className="stack">
          <button
            type="button"
            className="primary-button"
            disabled={saving}
            onClick={() => void onSave()}
          >
            {saving ? t('expense.saving') : t('transfer.saveTransfer')}
          </button>
          <Link className="secondary-button" to="/transactions">
            {t('app.cancel')}
          </Link>
        </div>
      </section>
    </AppShell>
  )
}
