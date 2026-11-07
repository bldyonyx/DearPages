import { rolldown } from 'rolldown'
import { fileURLToPath } from 'node:url'

// Firebase archives only the functions source directory. Bundle the existing
// core/adapters into that directory; never copy .env, credentials or app assets.
const bundle = await rolldown({
  input: fileURLToPath(new URL('index.mjs', import.meta.url)), platform: 'node',
  external: [/^node:/, /^firebase-functions(?:\/|$)/],
})
try { await bundle.write({ file: fileURLToPath(new URL('dist/index.mjs', import.meta.url)), format: 'esm', codeSplitting: false }) }
finally { await bundle.close() }
