import { db } from '@/db'
import { titleSuggestionSchema } from '@/domain/schemas'
import type { TitleSuggestion } from '@/domain/types'

export async function listSuggestions(): Promise<TitleSuggestion[]> {
  return db.titleSuggestions.toArray()
}

export async function putSuggestion(suggestion: TitleSuggestion): Promise<void> {
  await db.titleSuggestions.put(titleSuggestionSchema.parse(suggestion))
}

export async function deleteSuggestion(normalizedTitle: string): Promise<void> {
  await db.titleSuggestions.delete(normalizedTitle)
}

export async function syncSuggestionRow(
  before: TitleSuggestion[],
  after: TitleSuggestion[],
  normalizedTitle: string,
): Promise<void> {
  const next = after.find((row) => row.normalizedTitle === normalizedTitle)
  const prev = before.find((row) => row.normalizedTitle === normalizedTitle)
  if (next) {
    await putSuggestion(next)
  } else if (prev) {
    await deleteSuggestion(normalizedTitle)
  }
}
