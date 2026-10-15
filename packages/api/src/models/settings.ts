import z from 'zod';

const toJwksUri = (issuer: string): string => {
  const normalizedIssuer = issuer.endsWith('/') ? issuer.slice(0, -1) : issuer;
  return `${normalizedIssuer.replace('/v2.0', '')}/discovery/v2.0/keys`;
};

export const EnvSchema = z
  .object({
    PORT: z.coerce.number().int().positive().default(4000),
    CORS_WHITELIST: z
      .string()
      .transform((val) =>
        val
          ?.split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      )
      .pipe(z.array(z.url()).min(1)),
    LOCAL_DEV: z
      .string()
      .optional()
      .transform((value) => value === 'true')
      .pipe(z.boolean())
      .default(false),
    APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),
    AGENT_URI: z.string().min(1),
    LANGSMITH_KEY: z.string().optional(),
    GRAPH_ID: z.string().min(1),
    JWT_ISSUER: z.string().min(1),
    JWT_AUDIENCE: z
      .string()
      .min(1)
      .transform((val) => val.split(',').map((audience) => audience.trim()))
      .pipe(z.array(z.string().min(1)).min(1)),
    JWT_REQUIRED_SCOPES: z
      .string()
      .transform((val) =>
        val
          ?.split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      )
      .pipe(z.array(z.string()).min(1)),
  })
  .transform((env) => ({
    port: env.PORT,
    localDev: env.LOCAL_DEV,
    agentUri: env.AGENT_URI,
    langsmithKey: env.LANGSMITH_KEY,
    corsWhitelist: env.CORS_WHITELIST,
    graphId: env.GRAPH_ID,
    appInsightsConnectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING,
    jwtIssuer: env.JWT_ISSUER,
    jwksUri: toJwksUri(env.JWT_ISSUER),
    jwtAudience: env.JWT_AUDIENCE,
    jwtRequiredScopes: env.JWT_REQUIRED_SCOPES,
  }));

export type Settings = z.infer<typeof EnvSchema>;
