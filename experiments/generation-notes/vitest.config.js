import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', reporters: ['verbose'], include: ['notes.emulator.js'], testTimeout: 15000, hookTimeout: 20000 } })
