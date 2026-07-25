import { describe, expect, it } from 'vitest'
import { financialDateSchema } from '@/domain/schemas/common'
import {
  accountSchema,
  currencySchema,
  transactionSchema,
  treatmentSchema,
  userSettingsSchema,
} from '@/domain/schemas/entities'

describe('domain schemas', () => {
  it('accepts a valid financial date', () => {
    expect(financialDateSchema.parse('2026-07-24')).toBe('2026-07-24')
  })

  it('rejects non calendar financial dates', () => {
    expect(() => financialDateSchema.parse('07/24/2026')).toThrow()
  })

  it('validates currency and account money as integer minor units', () => {
    const currency = currencySchema.parse({
      code: 'USD',
      displayName: 'US Dollar',
      symbol: '$',
      decimalPlaces: 2,
      active: true,
    })
    expect(currency.code).toBe('USD')

    const account = accountSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'Main Checking',
      type: 'checking',
      currencyCode: 'USD',
      initialBalanceMinor: 10050,
      initialBalanceDate: '2026-01-01',
      icon: null,
      sortOrder: 0,
      isDefault: true,
      isActive: true,
      includeInTotalNetBalance: true,
      notes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      archivedAt: null,
    })
    expect(account.initialBalanceMinor).toBe(10050)
  })

  it('keeps title independent from category in the transaction shape', () => {
    const tx = transactionSchema.parse({
      id: '22222222-2222-4222-8222-222222222222',
      date: '2026-07-24',
      title: 'Almuerzo Sara',
      normalizedTitle: 'almuerzo sara',
      notes: null,
      transactionType: 'expense',
      accountId: '11111111-1111-4111-8111-111111111111',
      categoryId: '33333333-3333-4333-8333-333333333333',
      fundId: null,
      treatmentId: '44444444-4444-4444-8444-444444444444',
      originalAmountMinor: 2800,
      originalCurrencyCode: 'USD',
      accountAmountMinor: 2800,
      accountCurrencyCode: 'USD',
      baseCurrencyAmountMinor: 2800,
      exchangeRate: null,
      exchangeRateSource: null,
      destinationAccountId: null,
      linkedTransferId: null,
      linkedTransactionId: null,
      entrySource: 'manual',
      createdAt: '2026-07-24T12:00:00.000Z',
      updatedAt: '2026-07-24T12:00:00.000Z',
      deletedAt: null,
    })
    expect(tx.title).toBe('Almuerzo Sara')
    expect(tx.categoryId).not.toBeNull()
  })

  it('validates system treatment behavior keys', () => {
    const treatment = treatmentSchema.parse({
      id: '55555555-5555-4555-8555-555555555555',
      behaviorKey: 'monthly_budget',
      displayName: 'Monthly Budget',
      description: null,
      countsTowardMonthlyBudget: true,
      countsAsAccountMovement: true,
      isTransferBehavior: false,
      isSystem: true,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
    expect(treatment.behaviorKey).toBe('monthly_budget')
  })

  it('validates default settings shape', () => {
    const settings = userSettingsSchema.parse({
      id: 'default',
      preferredLanguage: 'en',
      baseCurrency: 'USD',
      locale: 'en-US',
      financialPeriodStartDay: 16,
      firstDayOfWeek: 1,
      defaultAccountId: null,
      defaultFundId: null,
      defaultTreatmentId: null,
      requireConfirmationBeforeSaving: true,
      enableVoiceInput: true,
      enableSmartSuggestions: true,
      showAdvancedTransactionFields: false,
      themePreference: 'system',
      onboardingCompleted: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: 1,
    })
    expect(settings.preferredLanguage).toBe('en')
  })
})
