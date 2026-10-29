import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['memberships.emulator.js'], reporters: ['verbose'], testTimeout: 15000, hookTimeout: 20000 } })
