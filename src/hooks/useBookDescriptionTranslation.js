import { useEffect, useMemo, useRef, useState } from 'react'

import { translateText } from '../services/translationService.js'
import { detectDescriptionLanguage } from '../utils/descriptionLanguage.js'
import {
  createTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
} from '../utils/translationSessionCache.js'

const TARGET_LANGUAGE = 'fr'

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
      })
      return
    }

    setTranslationState({
      cacheKey,
      translatedDescription: '',
      isShowingTranslation: false,
      isTranslating: true,
      translationError: '',
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
      })
    } catch {
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
    translationError,
    showOriginalDescription,
    translateDescription,
  }
}
