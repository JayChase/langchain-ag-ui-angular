import { z } from 'zod';

export const HaikuInputSchema = z.object({
  subject: z.string().describe('The subject to write the haiku about'),
});
export type HaikuInput = z.infer<typeof HaikuInputSchema>;

export const HaikuResultSchema = z.object({
  japanese: z.string(),
  english: z.string(),
  sumiE: z.string(),
});
export type HaikuResult = z.infer<typeof HaikuResultSchema>;
