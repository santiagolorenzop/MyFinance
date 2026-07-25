import { z } from 'zod'

/** Local calendar financial date: YYYY-MM-DD (never UTC-sliced). */
export const financialDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid financial date')

export const isoTimestampSchema = z.string().datetime({ offset: true }).or(z.string().datetime())

export const moneyMinorSchema = z
  .number()
  .int('Money must be an integer in minor units')
  .finite()

export const moneyAmountSchema = z.object({
  currencyCode: z.string().min(1),
  minorUnits: moneyMinorSchema,
})

export const idSchema = z.string().uuid()
