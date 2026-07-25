import type { Account, TitleSuggestion, Transaction } from '@/domain/types'

export type AccountPickerSection = 'default' | 'recent' | 'frequent' | 'all'

export interface RankedAccount {
  account: Account
  section: AccountPickerSection
}

/**
 * Order active accounts for expense entry: default → recent → frequent → remaining.
 */
export function rankAccountsForPicker(input: {
  accounts: Account[]
  defaultAccountId: string | null
  recentTransactions: Transaction[]
  suggestions: TitleSuggestion[]
}): RankedAccount[] {
  const active = input.accounts.filter(
    (account) => account.isActive && account.archivedAt == null,
  )
  const byId = new Map(active.map((account) => [account.id, account]))
  const seen = new Set<string>()
  const ranked: RankedAccount[] = []

  function push(id: string | null | undefined, section: AccountPickerSection) {
    if (!id || seen.has(id)) return
    const account = byId.get(id)
    if (!account) return
    seen.add(id)
    ranked.push({ account, section })
  }

  const defaultId =
    input.defaultAccountId ??
    active.find((account) => account.isDefault)?.id ??
    null
  push(defaultId, 'default')

  for (const tx of input.recentTransactions) {
    push(tx.accountId, 'recent')
  }

  const frequent = [...input.suggestions]
    .filter((row) => row.mostUsedAccountId != null)
    .sort((a, b) => b.useCount - a.useCount)

  for (const row of frequent) {
    push(row.mostUsedAccountId, 'frequent')
  }

  for (const account of active) {
    push(account.id, 'all')
  }

  return ranked
}
