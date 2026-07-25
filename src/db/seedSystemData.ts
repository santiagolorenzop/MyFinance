import { SETTINGS_ROW_ID, SCHEMA_VERSION } from '@/config/app'
import { COMMON_CURRENCIES } from '@/config/currencies'
import { db } from '@/db/database'
import type { Treatment, UserSettings } from '@/domain/types'

function nowIso(): string {
  return new Date().toISOString()
}

function createId(): string {
  return crypto.randomUUID()
}

/** System treatments with stable behavior keys (English display names). */
export function createSystemTreatments(now = nowIso()): Treatment[] {
  return [
    {
      id: createId(),
      behaviorKey: 'monthly_budget',
      displayName: 'Monthly Budget',
      description: 'Counts toward the monthly budget and moves account balances.',
      countsTowardMonthlyBudget: true,
      countsAsAccountMovement: true,
      isTransferBehavior: false,
      isSystem: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId(),
      behaviorKey: 'excluded',
      displayName: 'Excluded',
      description: 'Moves account balances but does not count toward the monthly budget.',
      countsTowardMonthlyBudget: false,
      countsAsAccountMovement: true,
      isTransferBehavior: false,
      isSystem: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId(),
      behaviorKey: 'first_month_extra',
      displayName: 'First Month Extra',
      description: 'Setup or first-month spending kept separate from normal monthly budget.',
      countsTowardMonthlyBudget: false,
      countsAsAccountMovement: true,
      isTransferBehavior: false,
      isSystem: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: createId(),
      behaviorKey: 'internal_transfer',
      displayName: 'Internal Transfer',
      description: 'Transfer between accounts; does not count as spending or income.',
      countsTowardMonthlyBudget: false,
      countsAsAccountMovement: true,
      isTransferBehavior: true,
      isSystem: true,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

export function createDefaultSettings(
  now = nowIso(),
  defaultTreatmentId: string | null = null,
): UserSettings {
  return {
    id: SETTINGS_ROW_ID,
    preferredLanguage: 'en',
    baseCurrency: 'USD',
    locale: 'en-US',
    financialPeriodStartDay: 1,
    firstDayOfWeek: 1,
    defaultAccountId: null,
    defaultFundId: null,
    defaultTreatmentId,
    requireConfirmationBeforeSaving: true,
    enableVoiceInput: true,
    enableSmartSuggestions: true,
    showAdvancedTransactionFields: false,
    themePreference: 'system',
    onboardingCompleted: false,
    createdAt: now,
    updatedAt: now,
    schemaVersion: SCHEMA_VERSION,
  }
}

/**
 * Seeds system currencies, treatments, and default settings if the DB is empty.
 * Does not insert personal accounts, categories, or transactions.
 */
export async function ensureSystemData(): Promise<void> {
  await db.transaction(
    'rw',
    db.settings,
    db.currencies,
    db.treatments,
    async () => {
      const currencyCount = await db.currencies.count()
      if (currencyCount === 0) {
        await db.currencies.bulkAdd(COMMON_CURRENCIES)
      }

      const treatmentCount = await db.treatments.count()
      let monthlyBudgetId: string | null = null

      if (treatmentCount === 0) {
        const treatments = createSystemTreatments()
        await db.treatments.bulkAdd(treatments)
        monthlyBudgetId =
          treatments.find((t) => t.behaviorKey === 'monthly_budget')?.id ?? null
      } else {
        const monthly = await db.treatments
          .where('behaviorKey')
          .equals('monthly_budget')
          .first()
        monthlyBudgetId = monthly?.id ?? null
      }

      const settings = await db.settings.get(SETTINGS_ROW_ID)
      if (!settings) {
        await db.settings.add(createDefaultSettings(nowIso(), monthlyBudgetId))
      }
    },
  )
}
