import { createBookMutationContext } from '../utils/bookMutationContext.js'
import { useMemo } from 'react'
import { createGenerationPersonalBackend } from '../integration/generationPersonalBackend.js'
import useLibraryBackend from './useLibraryBackend.js'
import { useLegacyBookLibraryState } from './useLegacyBookLibraryState.js'
import useGenerationBookLibraryState from './useGenerationBookLibraryState.js'

export function useBookLibraryState(options) {
  const backend = useLibraryBackend(options.userId)
  // Both hooks keep stable React ordering. Only the selected path receives authority.
  const legacy = useLegacyBookLibraryState({ ...options, userId: backend.mode === 'legacy' ? options.userId : undefined,
    routeState: backend.mode === 'legacy' ? options.routeState : undefined })
  const generation = useGenerationBookLibraryState({ ...options, backend })
  const context = generation.libraryBook?.generationContext
  const { uid, bookId, generation: bookGeneration } = context || {}
  const personalBackend = useMemo(() => backend.mode === 'generation' && backend.facade && bookGeneration
    ? createGenerationPersonalBackend(backend.facade, createBookMutationContext({ uid, bookId, generation: bookGeneration })) : null,
  [backend.mode, backend.facade, uid, bookId, bookGeneration])
  return { ...(backend.mode === 'legacy' ? legacy : generation), libraryMode: backend.mode, personalBackend }
}
