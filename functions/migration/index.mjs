import { onRequest } from 'firebase-functions/v2/https'
import { defineString } from 'firebase-functions/params'
import { createPrivateFinalizationHandler } from './handler.server.mjs'

// No default runtime identity. No public/callable/database/Auth/scheduled trigger.
const runtimeServiceAccount = defineString('MIGRATION_RUNTIME_SERVICE_ACCOUNT')
export const finalizeHistoricalImport = onRequest({
  invoker: 'private', ingressSettings: 'ALLOW_INTERNAL_ONLY', cors: false,
  serviceAccount: runtimeServiceAccount, region: 'europe-west6',
  minInstances: 0, maxInstances: 1, concurrency: 1, timeoutSeconds: 120,
}, createPrivateFinalizationHandler())
// Intentionally no real verifier, ADC, token provider or transport wired here.
// Even an authenticated Cloud Run invoker cannot execute the real finalizer.
