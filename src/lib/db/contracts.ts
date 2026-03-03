import { z } from 'zod'

export type ErrorResponse = {
  status: number
  code: string
  message: string
  details?: Record<string, unknown>
  requestId?: string
}

export const SessionUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).default('user'),
  credits: z.number().int().nonnegative(),
  credits_reset_at: z.string().nullable(),
})

export const EmptyTableCandidateSchema = z.object({
  table_schema: z.string(),
  table_name: z.string(),
  estimated_row_count: z.number().int(),
  has_inbound_fk: z.boolean(),
  has_outbound_fk: z.boolean(),
  has_triggers: z.boolean(),
})
