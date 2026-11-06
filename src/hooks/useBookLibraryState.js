import useLibraryBackend from './useLibraryBackend.js'
import { useLegacyBookLibraryState } from './useLegacyBookLibraryState.js'
import useGenerationBookLibraryState from './useGenerationBookLibraryState.js'

export function useBookLibraryState(options) {
  const backend = useLibraryBackend(options.userId)
  // Both hooks keep stable React ordering. Only the selected path receives authority.
  const legacy = useLegacyBookLibraryState({ ...options, userId: backend.mode === 'legacy' ? options.userId : undefined,
    routeState: backend.mode === 'legacy' ? options.routeState : undefined })
  const generation = useGenerationBookLibraryState({ ...options, backend })
  return { ...(backend.mode === 'legacy' ? legacy : generation), libraryMode: backend.mode }
}
