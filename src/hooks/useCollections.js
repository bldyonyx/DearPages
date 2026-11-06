import { useAuth } from '../context/AuthContext.jsx'
import useLibraryBackend from './useLibraryBackend.js'
import useLegacyCollections from './useLegacyCollections.js'
import useGenerationCollections from './useGenerationCollections.js'

export default function useCollections() {
  const { user } = useAuth()
  const backend = useLibraryBackend(user?.uid)
  const legacy = useLegacyCollections(backend.mode === 'legacy')
  const generation = useGenerationCollections(backend, user)
  return backend.mode === 'legacy' ? legacy : generation
}
