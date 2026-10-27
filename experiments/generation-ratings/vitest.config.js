import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['ratings.emulator.js'], reporters: ['verbose'], testTimeout: 15000, hookTimeout: 20000 } })
