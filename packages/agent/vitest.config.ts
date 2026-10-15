import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    env: {
      CHAT_MODEL_NAME: 'gpt-4o',
      AZURE_AI_ENDPOINT: 'https://example.openai.azure.com',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
