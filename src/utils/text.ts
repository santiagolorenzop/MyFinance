/** Case- and accent-insensitive normalization for search only. */
export function normalizeForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function searchHaystackIncludes(haystack: string, needle: string): boolean {
  if (!needle) return false
  return normalizeForSearch(haystack).includes(normalizeForSearch(needle))
}
