import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { validateEmulatorEnv } from './src/config/firebaseEmulator.js'
import { emulatorServer, viteEmulatorPlugin } from './scripts/viteEmulatorPlugin.mjs'

export default defineConfig(({ mode, command }) => {
  const isolated = mode === 'emulator'
  const envDir = isolated ? fileURLToPath(new URL('./emulator', import.meta.url)) : process.cwd()
  validateEmulatorEnv(loadEnv(mode, envDir, 'VITE_'), mode, command === 'build')
  return {
    ...(isolated ? { envDir, server: emulatorServer } : {}),
    plugins: [
      react(),
      tailwindcss(),
      ...(isolated ? [viteEmulatorPlugin()] : []),
    ],

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/test/setup.js',
      css: true,
    },
  }
})
