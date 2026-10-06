import { useEffect, useMemo, useRef, useState } from 'react'

import { translateText } from '../services/translationService.js'
import { detectDescriptionLanguage } from '../utils/descriptionLanguage.js'
import {
  createTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
} from '../utils/translationSessionCache.js'

const TARGET_LANGUAGE = 'fr'

function formatTemporaryDiagnostic(error) {
  const diagnostic = error?.diagnostic

  if (!diagnostic) {
    return ''
  }

  const parts = [
    `status=${diagnostic.status ?? 'none'}`,
    `code=${diagnostic.googleErrorCode ?? 'none'}`,
    `googleStatus=${diagnostic.googleErrorStatus ?? 'none'}`,
    `reason=${diagnostic.googleErrorReason ?? 'none'}`,
    `message=${diagnostic.googleErrorMessage ?? 'none'}`,
    `origin=${diagnostic.origin || 'unknown'}`,
    `hasApiKey=${diagnostic.hasApiKey ? 'true' : 'false'}`,
    `hasHttpResponse=${
      diagnostic.hasHttpResponse ? 'true' : 'false'
    }`,
  ]

  return `Diag temporaire : ${parts.join('; ')}`
}

/**
 * Owns the BookPage description translation state.
 *
 * The hook keys its state to the exact displayed source description, so route
 * state and later canonical metadata cannot accidentally show a translation
 * that belongs to a previous description.
 *
 * @param {Object} book - Current BookPage book.
 * @returns {Object} Description text, action labels, and handlers.
 */
export function useBookDescriptionTranslation(book) {
  const originalDescription = String(book?.description || '').trim()
  const sourceLanguage = useMemo(
    () =>
      detectDescriptionLanguage(
        originalDescription,
        book?.language
      ),
    [originalDescription, book?.language]
  )
  const cacheKey = useMemo(
    () =>
      createTranslationCacheKey({
        bookId:
          book?.googleBooksId ||
          book?.openLibraryId ||
          book?.id ||
          '',
        source: book?.source || 'unknown',
        sourceLanguage,
        targetLanguage: TARGET_LANGUAGE,
        description: originalDescription,
      }),
    [
      book?.googleBooksId,
      book?.id,
      book?.openLibraryId,
      book?.source,
      originalDescription,
      sourceLanguage,
    ]
  )
  const activeCacheKeyRef = useRef(cacheKey)

  useEffect(() => {
    activeCacheKeyRef.current = cacheKey
  }, [cacheKey])

  const [translationState, setTranslationState] = useState({
    cacheKey: null,
    translatedDescription: '',
    isShowingTranslation: false,
    isTranslating: false,
    translationError: '',
    translationDiagnostic: '',
  })

  const hasDescription = Boolean(originalDescription)
  const isTranslationAvailable =
    hasDescription && sourceLanguage === 'en'
  const isCurrentDescription =
    translationState.cacheKey === cacheKey
  const cachedDescription =
    isTranslationAvailable && !isCurrentDescription
      ? getCachedTranslation(cacheKey) || ''
      : ''
  const translatedDescription = isCurrentDescription
    ? translationState.translatedDescription
    : cachedDescription
  const isShowingTranslation =
    isCurrentDescription &&
    translationState.isShowingTranslation
  const isTranslating =
    isCurrentDescription && translationState.isTranslating
  const translationError = isCurrentDescription
    ? translationState.translationError
    : ''
  const translationDiagnostic = isCurrentDescription
    ? translationState.translationDiagnostic
    : ''

  async function translateDescription() {
    if (!isTranslationAvailable || isTranslating) {
      return
    }

    if (translatedDescription) {
      setTranslationState({
        cacheKey,
        translatedDescription,
        isShowingTranslation: true,
        isTranslating: false,
        translationError: '',
        translationDiagnostic: '',
      })
      return
    }

    setTranslationState({
      cacheKey,
      translatedDescription: '',
      isShowingTranslation: false,
      isTranslating: true,
      translationError: '',
      translationDiagnostic: '',
    })

    try {
      const translatedText = await translateText(
        originalDescription,
        sourceLanguage,
        TARGET_LANGUAGE
      )

      if (activeCacheKeyRef.current !== cacheKey) {
        return
      }

      setCachedTranslation(cacheKey, translatedText)
      setTranslationState({
        cacheKey,
        translatedDescription: translatedText,
        isShowingTranslation: true,
        isTranslating: false,
        translationError: '',
        translationDiagnostic: '',
      })
    } catch (translationError) {
      if (activeCacheKeyRef.current !== cacheKey) {
        return
      }

      setTranslationState({
        cacheKey,
        translatedDescription: '',
        isShowingTranslation: false,
        isTranslating: false,
        translationError:
          'Impossible de traduire ce résumé pour le moment.',
        translationDiagnostic:
          formatTemporaryDiagnostic(translationError),
      })
    } finally {
      if (activeCacheKeyRef.current === cacheKey) {
        setTranslationState((currentState) =>
          currentState.cacheKey === cacheKey
            ? {
                ...currentState,
                isTranslating: false,
              }
            : currentState
        )
      }
    }
  }

  function showOriginalDescription() {
    setTranslationState({
      cacheKey,
      translatedDescription,
      isShowingTranslation: false,
      isTranslating: false,
      translationError: '',
      translationDiagnostic: '',
    })
  }

  const displayedDescription =
    isShowingTranslation && translatedDescription
      ? translatedDescription
      : originalDescription

  const translationActionLabel = isShowingTranslation
    ? 'Voir l’original'
    : translatedDescription
      ? 'Voir la traduction'
      : 'Traduire en français'

  return {
    displayedDescription,
    hasDescription,
    isShowingTranslation,
    isTranslating,
    isTranslationAvailable,
    translationActionLabel,
    translationDiagnostic,
    translationError,
    showOriginalDescription,
    translateDescription,
  }
}
