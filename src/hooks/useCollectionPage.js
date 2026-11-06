import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import useLibraryBackend from './useLibraryBackend.js'
import useLegacyCollectionPage from './useLegacyCollectionPage.js'
import useGenerationCollections from './useGenerationCollections.js'

export default function useCollectionPage() {
  const { user } = useAuth()
  const { id } = useParams()
  const backend = useLibraryBackend(user?.uid)
  const legacy = useLegacyCollectionPage(backend.mode === 'legacy')
  const generation = useGenerationCollections(backend, user, id)
  return backend.mode === 'legacy' ? legacy : generation
}
