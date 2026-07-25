import { addCalendarDays } from '@/utils/dates'
import { normalizeForSearch } from '@/utils/text'
import type {
  VoiceParseContext,
  VoiceParseResult,
  VoiceParser,
} from '@/services/voiceParser/types'

const AMOUNT_RE =
  /(?:(?<sym>\$|€|£)\s*)?(?<num>\d{1,3}(?:[.,]\d{3})*[.,]\d+|\d+[.,]\d+|\d+)(?:\s*(?<unit>dollars?|usd|euros?|eur|pesos?|cop|pounds?|gbp))?/gi

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function normalizeAmountText(raw: string): string {
  const trimmed = raw.trim()
  const commaCount = (trimmed.match(/,/g) ?? []).length
  const dotCount = (trimmed.match(/\./g) ?? []).length
  if (commaCount > 0 && dotCount > 0) {
    const lastComma = trimmed.lastIndexOf(',')
    const lastDot = trimmed.lastIndexOf('.')
    if (lastComma > lastDot) {
      return trimmed.replace(/\./g, '').replace(',', '.')
    }
    return trimmed.replace(/,/g, '')
  }
  if (commaCount === 1 && dotCount === 0) {
    return trimmed.replace(',', '.')
  }
  return trimmed.replace(/,/g, '')
}

function currencyFromToken(
  token: string | undefined,
  symbol: string | undefined,
  context: VoiceParseContext,
): { code: string; confidence: number } | null {
  if (token) {
    const key = normalizeForSearch(token)
    const map: Record<string, string> = {
      dollar: 'USD',
      dollars: 'USD',
      usd: 'USD',
      euro: 'EUR',
      euros: 'EUR',
      eur: 'EUR',
      peso: 'COP',
      pesos: 'COP',
      cop: 'COP',
      pound: 'GBP',
      pounds: 'GBP',
      gbp: 'GBP',
    }
    const mapped = map[key]
    if (mapped && context.currencies.some((row) => row.code === mapped)) {
      return { code: mapped, confidence: 0.95 }
    }
    const byCode = context.currencies.find(
      (row) => normalizeForSearch(row.code) === key,
    )
    if (byCode) return { code: byCode.code, confidence: 0.95 }
  }

  if (symbol) {
    const bySymbol = context.currencies.filter((row) => row.symbol === symbol)
    if (bySymbol.length === 1) {
      return { code: bySymbol[0]!.code, confidence: 0.7 }
    }
    if (symbol === '$') {
      const usd = context.currencies.find((row) => row.code === 'USD')
      if (usd) return { code: 'USD', confidence: 0.55 }
    }
  }

  return null
}

function matchDate(
  normalized: string,
  context: VoiceParseContext,
): { date: string; confidence: number; matched: string } | null {
  if (/\btoday\b/.test(normalized)) {
    return { date: context.today, confidence: 1, matched: 'today' }
  }
  if (/\byesterday\b/.test(normalized)) {
    return {
      date: addCalendarDays(context.today, -1),
      confidence: 1,
      matched: 'yesterday',
    }
  }
  return null
}

function matchAccount(
  normalized: string,
  context: VoiceParseContext,
): { accountId: string; confidence: number; matched: string } | null {
  let best: { accountId: string; confidence: number; matched: string; len: number } | null =
    null

  for (const account of context.accounts) {
    const alias = normalizeForSearch(account.name)
    if (!alias) continue
    if (!normalized.includes(alias)) continue
    const confidence = alias.length >= 4 ? 0.9 : 0.75
    if (!best || alias.length > best.len) {
      best = {
        accountId: account.id,
        confidence,
        matched: alias,
        len: alias.length,
      }
    }
  }

  return best
    ? {
        accountId: best.accountId,
        confidence: best.confidence,
        matched: best.matched,
      }
    : null
}

function stripMatchedPhrases(text: string, phrases: string[]): string {
  let next = text
  for (const phrase of phrases) {
    if (!phrase) continue
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi')
    next = next.replace(re, ' ')
  }
  return next.replace(/\s+/g, ' ').trim()
}

/**
 * Deterministic offline parser for expense dictation utterances.
 */
export class DeterministicVoiceParser implements VoiceParser {
  readonly id = 'deterministic-v1'

  parse(text: string, context: VoiceParseContext): VoiceParseResult {
    const rawText = text.trim()
    const empty: VoiceParseResult = {
      rawText,
      amountText: null,
      currencyCode: null,
      accountId: null,
      date: null,
      title: null,
      confidence: 0,
      fields: { amount: 0, currency: 0, account: 0, date: 0, title: 0 },
    }
    if (!rawText) return empty

    const normalized = normalizeForSearch(rawText)
    const removed: string[] = []

    const dateMatch = matchDate(normalized, context)
    if (dateMatch) removed.push(dateMatch.matched)

    const accountMatch = matchAccount(normalized, context)
    if (accountMatch) removed.push(accountMatch.matched)

    let amountText: string | null = null
    let amountConfidence = 0
    let currencyCode: string | null = null
    let currencyConfidence = 0

    AMOUNT_RE.lastIndex = 0
    const amountMatch = AMOUNT_RE.exec(rawText)
    if (amountMatch?.groups?.num) {
      amountText = normalizeAmountText(amountMatch.groups.num)
      amountConfidence = 0.95
      removed.push(amountMatch[0]!)

      const fromAmount = currencyFromToken(
        amountMatch.groups.unit,
        amountMatch.groups.sym,
        context,
      )
      if (fromAmount) {
        currencyCode = fromAmount.code
        currencyConfidence = fromAmount.confidence
      }
    }

    if (!currencyCode) {
      for (const currency of context.currencies) {
        const code = normalizeForSearch(currency.code)
        if (code && new RegExp(`\\b${escapeRegExp(code)}\\b`, 'i').test(normalized)) {
          currencyCode = currency.code
          currencyConfidence = 0.9
          removed.push(currency.code)
          break
        }
      }
    }

    if (!currencyCode) {
      currencyCode = context.defaultCurrencyCode
      currencyConfidence = amountText ? 0.4 : 0
    }

    let title = stripMatchedPhrases(rawText, removed)
    // Drop common filler words left after stripping structured tokens.
    title = title
      .replace(/\b(on|for|with|from|my|the|a|an|at|in|to)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()

    const titleConfidence = title.length >= 2 ? 0.8 : title ? 0.4 : 0

    const fields = {
      amount: amountConfidence,
      currency: currencyConfidence,
      account: accountMatch?.confidence ?? 0,
      date: dateMatch?.confidence ?? 0,
      title: titleConfidence,
    }

    const weights = { amount: 0.4, currency: 0.1, account: 0.15, date: 0.1, title: 0.25 }
    const confidence =
      fields.amount * weights.amount +
      fields.currency * weights.currency +
      fields.account * weights.account +
      fields.date * weights.date +
      fields.title * weights.title

    return {
      rawText,
      amountText,
      currencyCode,
      accountId: accountMatch?.accountId ?? null,
      date: dateMatch?.date ?? null,
      title: title || null,
      confidence: Math.min(1, Number(confidence.toFixed(3))),
      fields,
    }
  }
}

export const deterministicVoiceParser: VoiceParser = new DeterministicVoiceParser()
