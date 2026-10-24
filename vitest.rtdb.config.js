import { defineConfig } from 'vitest/config'

// Explicit opt-in: normal Vitest runs never open emulator/production connections.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rtdb/*.emulator.js'],
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
