import { db } from '@/db'
import { treatmentSchema } from '@/domain/schemas'
import type { Treatment } from '@/domain/types'
import { IntegrityError, treatmentHasTransactions } from '@/repositories/integrity'

export async function listTreatments(): Promise<Treatment[]> {
  return db.treatments.toArray()
}

/** Users may rename display labels; system behavior keys stay immutable. */
export async function renameTreatment(
  id: string,
  displayName: string,
): Promise<Treatment> {
  const existing = await db.treatments.get(id)
  if (!existing) throw new Error('Treatment not found')
  const next = treatmentSchema.parse({
    ...existing,
    displayName: displayName.trim(),
    updatedAt: new Date().toISOString(),
  })
  await db.treatments.put(next)
  return next
}

export async function setTreatmentActive(id: string, isActive: boolean): Promise<Treatment> {
  const existing = await db.treatments.get(id)
  if (!existing) throw new Error('Treatment not found')
  const next = treatmentSchema.parse({
    ...existing,
    isActive,
    updatedAt: new Date().toISOString(),
  })
  await db.treatments.put(next)
  return next
}

export async function deleteTreatment(id: string): Promise<void> {
  const existing = await db.treatments.get(id)
  if (!existing) throw new Error('Treatment not found')
  if (existing.isSystem) {
    throw new IntegrityError('System treatments cannot be deleted.')
  }
  if (await treatmentHasTransactions(id)) {
    throw new IntegrityError(
      'This treatment cannot be deleted because it has transaction history.',
    )
  }
  await db.treatments.delete(id)
}
