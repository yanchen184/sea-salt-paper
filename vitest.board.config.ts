import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/flow-board/**/*.test.ts'],
    environment: 'node',
  },
})
