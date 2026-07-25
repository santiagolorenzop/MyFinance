import type { AccountType } from '@/domain/enums'
import type { Account } from '@/domain/types'

export interface AccountSafePatch {
  name?: string
  type?: AccountType
  includeInTotalNetBalance?: boolean
  isActive?: boolean
  isDefault?: boolean
  notes?: string | null
  icon?: string | null
  /** Archive when true (sets archivedAt upstream). */
  archive?: boolean
}

export interface AccountSensitivePatch {
  currencyCode?: string
  initialBalanceMinor?: number
  initialBalanceDate?: string
}

export type AccountUpdateRequest = AccountSafePatch & AccountSensitivePatch

export type AccountUpdateDecision =
  | {
      ok: true
      patch: AccountUpdateRequest
      warnings: string[]
    }
  | {
      ok: false
      error: string
      code: 'not_found' | 'archived' | 'currency_blocked' | 'initial_balance_blocked'
    }

/**
 * Decide which account fields may change given ledger history.
 * Persistence stays in the repository; this encodes safe-edit rules only.
 */
export function planAccountUpdate(input: {
  existing: Account | undefined
  patch: AccountUpdateRequest
  hasTransactions: boolean
}): AccountUpdateDecision {
  const { existing, patch, hasTransactions } = input
  if (!existing) {
    return { ok: false, error: 'Account not found', code: 'not_found' }
  }
  if (existing.archivedAt != null && !patch.archive) {
    return { ok: false, error: 'Archived accounts cannot be edited.', code: 'archived' }
  }

  const warnings: string[] = []
  const next: AccountUpdateRequest = { ...patch }

  if (
    patch.currencyCode != null &&
    patch.currencyCode !== existing.currencyCode
  ) {
    if (hasTransactions) {
      return {
        ok: false,
        error:
          'Account currency cannot be changed while transactions exist on this account.',
        code: 'currency_blocked',
      }
    }
  }

  if (
    patch.initialBalanceMinor != null &&
    patch.initialBalanceMinor !== existing.initialBalanceMinor
  ) {
    if (hasTransactions) {
      return {
        ok: false,
        error:
          'Initial balance cannot be changed while transactions exist. It would rewrite historical balances.',
        code: 'initial_balance_blocked',
      }
    }
  }

  if (
    patch.initialBalanceDate != null &&
    patch.initialBalanceDate !== existing.initialBalanceDate &&
    hasTransactions
  ) {
    return {
      ok: false,
      error:
        'Initial balance date cannot be changed while transactions exist.',
      code: 'initial_balance_blocked',
    }
  }

  if (patch.name != null && !patch.name.trim()) {
    return { ok: false, error: 'Enter a name.', code: 'not_found' }
  }

  if (patch.isActive === false && existing.isDefault) {
    warnings.push('Deactivating the default account clears its default flag.')
  }

  return { ok: true, patch: next, warnings }
}
