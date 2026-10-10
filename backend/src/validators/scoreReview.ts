import { z } from 'zod';

export const correctScoreSchema = z.object({
  field: z.enum(['test1', 'test2', 'test3', 'examination']),
  value: z.number().finite(),
  reason: z.string().trim().min(5, 'A meaningful correction reason is required').max(1000),
  expected_updated_at: z.string().datetime(),
});
