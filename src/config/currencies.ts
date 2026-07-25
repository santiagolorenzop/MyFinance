import type { Currency } from '@/domain/types'

/** Common ISO currencies seeded for onboarding/settings. Not personal data. */
export const COMMON_CURRENCIES: Currency[] = [
  {
    code: 'USD',
    displayName: 'US Dollar',
    symbol: '$',
    decimalPlaces: 2,
    active: true,
  },
  {
    code: 'COP',
    displayName: 'Colombian Peso',
    symbol: '$',
    decimalPlaces: 0,
    active: true,
  },
  {
    code: 'EUR',
    displayName: 'Euro',
    symbol: '€',
    decimalPlaces: 2,
    active: true,
  },
  {
    code: 'GBP',
    displayName: 'British Pound',
    symbol: '£',
    decimalPlaces: 2,
    active: true,
  },
  {
    code: 'MXN',
    displayName: 'Mexican Peso',
    symbol: '$',
    decimalPlaces: 2,
    active: true,
  },
]
