import type { FinancialDate } from '@/utils/dates'

export interface VoiceParseAccountAlias {
  id: string
  name: string
}

export interface VoiceParseCurrencyAlias {
  code: string
  symbol: string
}

export interface VoiceParseContext {
  accounts: VoiceParseAccountAlias[]
  currencies: VoiceParseCurrencyAlias[]
  today: FinancialDate
  defaultCurrencyCode: string
}

export interface VoiceParseFieldConfidence {
  amount: number
  currency: number
  account: number
  date: number
  title: number
}

/**
 * Structured result of a voice/dictation utterance.
 * Amount is returned as user-facing major units text — conversion stays in money services.
 */
export interface VoiceParseResult {
  rawText: string
  amountText: string | null
  currencyCode: string | null
  accountId: string | null
  date: FinancialDate | null
  title: string | null
  /** Overall 0–1 confidence. */
  confidence: number
  fields: VoiceParseFieldConfidence
}

/**
 * Pluggable parser interface — deterministic local parser is the v1 implementation.
 * Future smarter parsers can implement the same contract.
 */
export interface VoiceParser {
  readonly id: string
  parse(text: string, context: VoiceParseContext): VoiceParseResult
}

/** Voice/parsed entries must always show confirmation before save. */
export function voiceParseRequiresConfirmation(_result: VoiceParseResult): true {
  return true
}
