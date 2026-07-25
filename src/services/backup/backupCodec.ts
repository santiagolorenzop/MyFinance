/**
 * Encryption-ready backup codec interface.
 * v1 ships PlainJsonCodec only — no password encryption.
 */

export interface BackupCodec<TPayload = Record<string, unknown>> {
  readonly kind: 'plain'
  /** Encode payload for embedding in the envelope (plain = identity). */
  encode(payload: TPayload): TPayload
  /** Decode payload from the envelope (plain = identity + structural check). */
  decode(encoded: unknown): TPayload
}

export class PlainJsonCodec implements BackupCodec {
  readonly kind = 'plain' as const

  encode(payload: Record<string, unknown>): Record<string, unknown> {
    return payload
  }

  decode(encoded: unknown): Record<string, unknown> {
    if (encoded == null || typeof encoded !== 'object' || Array.isArray(encoded)) {
      throw new Error('Backup payload must be a plain object')
    }
    return encoded as Record<string, unknown>
  }
}

export const plainJsonCodec = new PlainJsonCodec()

export function getBackupCodec(kind: 'plain' = 'plain'): BackupCodec {
  if (kind === 'plain') return plainJsonCodec
  throw new Error(`Unsupported backup codec: ${String(kind)}`)
}
