import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Engine tests are pure functions over data — Node environment, no DOM needed.
// The path alias mirrors tsconfig.json so `@/lib/...` resolves under src/.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
