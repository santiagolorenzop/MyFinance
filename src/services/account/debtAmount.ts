/** Parse display amount + debt flag into signed minor units. */
export function signedMinorFromDebtInput(
  raw: string,
  decimalPlaces: number,
  isDebt: boolean,
  parse: (input: string, decimalPlaces: number) => number,
): number {
  const minor = parse(raw || '0', decimalPlaces)
  const abs = Math.abs(minor)
  if (isDebt) return -abs
  // If user typed an explicit minus on desktop, keep it even when debt unchecked.
  if (minor < 0) return minor
  return abs
}

export function isDebtMinor(minor: number): boolean {
  return minor < 0
}
