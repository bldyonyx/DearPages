import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['feasibility.emulator.js', 'batchAdapter.emulator.js', 'recovery.emulator.js'], fileParallelism: false, reporters: ['verbose'], testTimeout: 30000, hookTimeout: 20000 } })
