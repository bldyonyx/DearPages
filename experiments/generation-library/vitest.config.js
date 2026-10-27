import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node', include: ['library.emulator.js'],
    testTimeout: 15000, hookTimeout: 15000,
  },
})
