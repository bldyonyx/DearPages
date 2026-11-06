import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], test: {
  environment: 'jsdom', environmentOptions: { jsdom: { url: 'http://127.0.0.1:5501' } },
  include: ['reactLibrary.emulator.jsx', 'reactPersonal.emulator.jsx'], fileParallelism: false, setupFiles: ['../../src/test/setup.js'],
  reporters: ['verbose'], testTimeout: 30000, hookTimeout: 20000,
} })
