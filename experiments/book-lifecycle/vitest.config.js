import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lifecycle.emulator.js'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
