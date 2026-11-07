import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['import.emulator.js'], fileParallelism: false, testTimeout: 30000, hookTimeout: 20000 } })
