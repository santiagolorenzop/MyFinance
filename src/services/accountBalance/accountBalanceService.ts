import { addMinor, assertFiniteInteger } from '@/services/money'
import type { Account, Transaction, Treatment } from '@/domain/types'

export interface AccountBalanceResult {
  accountId: string
  currencyCode: string
  balanceMinor: number
}

function isActiveLedgerEntry(tx: Transaction): boolean {
  return tx.deletedAt == null
}

function treatmentMap(treatments: Treatment[]): Map<string, Treatment> {
  return new Map(treatments.map((item) => [item.id, item]))
}

/**
 * Outgoing transfer leg: has destinationAccountId set.
 * Incoming transfer leg: transfer type without destinationAccountId.
 */
export function isOutgoingTransferLeg(tx: Transaction): boolean {
  return tx.transactionType === 'transfer' && tx.destinationAccountId != null
}

export function isIncomingTransferLeg(tx: Transaction): boolean {
  return tx.transactionType === 'transfer' && tx.destinationAccountId == null
}

/**
 * Calculate account balance from initial balance + ledger.
 * Pure: does not mutate inputs or storage.
 */
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
  treatments: Treatment[],
): AccountBalanceResult {
  const byId = treatmentMap(treatments)
  let balance = assertFiniteInteger(account.initialBalanceMinor)

  for (const tx of transactions) {
    if (!isActiveLedgerEntry(tx)) continue
    if (tx.accountId !== account.id) continue

    const treatment = byId.get(tx.treatmentId)
    if (treatment && !treatment.countsAsAccountMovement) continue

    const amount = assertFiniteInteger(tx.accountAmountMinor)

    switch (tx.transactionType) {
      case 'income':
        balance = addMinor(balance, amount)
        break
      case 'expense':
        balance = addMinor(balance, -amount)
        break
      case 'transfer':
        if (isOutgoingTransferLeg(tx)) {
          balance = addMinor(balance, -amount)
        } else if (isIncomingTransferLeg(tx)) {
          balance = addMinor(balance, amount)
        }
        break
      case 'adjustment':
        // Signed accountAmountMinor: positive increases balance.
        balance = addMinor(balance, amount)
        break
      default:
        break
    }
  }

  return {
    accountId: account.id,
    currencyCode: account.currencyCode,
    balanceMinor: balance,
  }
}

export function calculateAllAccountBalances(
  accounts: Account[],
  transactions: Transaction[],
  treatments: Treatment[],
): AccountBalanceResult[] {
  return accounts.map((account) =>
    calculateAccountBalance(account, transactions, treatments),
  )
}

/** Accounts that participate in net totals (never mixes currencies). */
export function accountsIncludedInNetTotal(accounts: Account[]): Account[] {
  return accounts.filter(
    (account) =>
      account.isActive &&
      account.archivedAt == null &&
      account.includeInTotalNetBalance,
  )
}

/** Totals by currency code — never mixes currencies. */
export function totalBalancesByCurrency(
  balances: AccountBalanceResult[],
): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const balance of balances) {
    totals[balance.currencyCode] = addMinor(
      totals[balance.currencyCode] ?? 0,
      balance.balanceMinor,
    )
  }
  return totals
}

export interface BalancesViewModel {
  accountBalances: Array<AccountBalanceResult & { account: Account }>
  totalsByCurrency: Record<string, number>
}

/**
 * Compose balances view from ledger using existing balance helpers only.
 */
export function buildBalancesView(
  accounts: Account[],
  transactions: Transaction[],
  treatments: Treatment[],
): BalancesViewModel {
  const visibleAccounts = accounts.filter(
    (account) => account.isActive && account.archivedAt == null,
  )
  const accountBalances = calculateAllAccountBalances(
    visibleAccounts,
    transactions,
    treatments,
  ).map((balance) => ({
    ...balance,
    account: visibleAccounts.find((row) => row.id === balance.accountId)!,
  }))

  const included = accountsIncludedInNetTotal(visibleAccounts)
  const includedBalances = calculateAllAccountBalances(
    included,
    transactions,
    treatments,
  )

  return {
    accountBalances,
    totalsByCurrency: totalBalancesByCurrency(includedBalances),
  }
}

/** Recent ledger rows for one account (active only), newest first. */
export function recentTransactionsForAccount(
  transactions: Transaction[],
  accountId: string,
  limit = 40,
): Transaction[] {
  return transactions
    .filter((tx) => tx.deletedAt == null && tx.accountId === accountId)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    )
    .slice(0, limit)
}
