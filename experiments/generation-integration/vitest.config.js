import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['integration.emulator.js'], reporters: ['verbose'], testTimeout: 30000, hookTimeout: 20000 } })
