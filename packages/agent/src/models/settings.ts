import z from 'zod';

export const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(3000),
    LOCAL_DEV: z
      .string()
      .optional()
      .transform((value) => value === 'true')
      .pipe(z.boolean())
      .default(false),
    APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),
    CHAT_MODEL_NAME: z.string().min(1),
    AZURE_AI_ENDPOINT: z.string().min(1),
    AZURE_AI_API_VERSION: z.string().optional(),
    TEMPERATURE: z.coerce.number().optional(),
    MAX_TOKENS: z.coerce.number().int().positive().optional(),
    REDIS_URI: z.string().optional(),
    DATABASE_URI: z.string().optional(),
  })
  .transform((env) => ({
    port: env.PORT,
    localDev: env.LOCAL_DEV,
    appInsightsConnectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    chatModelName: env.CHAT_MODEL_NAME,
    azureAIEndpoint: env.AZURE_AI_ENDPOINT,
    azureAIApiVersion: env.AZURE_AI_API_VERSION,
    temperature: env.TEMPERATURE,
    maxTokens: env.MAX_TOKENS,
    redisUri: env.REDIS_URI,
    databaseUri: env.DATABASE_URI,
  }));

export type Settings = z.infer<typeof EnvSchema>;
