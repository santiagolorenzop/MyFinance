import { en, type MessageCatalog } from '@/i18n/en'

type NestedKeyOf<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? NestedKeyOf<T[K], `${Prefix}${K}.`>
    : `${Prefix}${K}`
}[keyof T & string]

export type TranslationKey = NestedKeyOf<MessageCatalog>

const catalogs = {
  en,
} as const

export type SupportedLocale = keyof typeof catalogs

/** Default UI locale for v1. No language toggle yet. */
export const DEFAULT_LOCALE: SupportedLocale = 'en'

function lookup(catalog: MessageCatalog, key: string): string | undefined {
  const parts = key.split('.')
  let current: unknown = catalog
  for (const part of parts) {
    if (typeof current !== 'object' || current === null || !(part in current)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[part]
  }
  return typeof current === 'string' ? current : undefined
}

/**
 * Resolve a UI string from the centralized catalog.
 * Never use for user-generated content.
 */
export function t(key: TranslationKey, locale: SupportedLocale = DEFAULT_LOCALE): string {
  const value = lookup(catalogs[locale], key)
  if (value === undefined) {
    if (import.meta.env.DEV) {
      console.warn(`[i18n] Missing key: ${key}`)
    }
    return key
  }
  return value
}

export { en }
