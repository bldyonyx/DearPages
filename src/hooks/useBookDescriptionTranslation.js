import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { translateText } from '../services/translationService.js'
import { detectDescriptionLanguage } from '../utils/descriptionLanguage.js'
import {
  createTranslationCacheKey,
  getCachedTranslation,
  setCachedTranslation,
} from '../utils/translationSessionCache.js'

const SUPPORTED_DESCRIPTION_TARGET_LANGUAGES = ['fr', 'en']

function getTargetLanguage(language) {
  const normalizedLanguage = String(language || '')
    .trim()
    .toLowerCase()
    .slice(0, 2)

  return SUPPORTED_DESCRIPTION_TARGET_LANGUAGES.includes(
    normalizedLanguage
  )
    ? normalizedLanguage
    : 'fr'
}

function getCacheSourceLanguage(sourceLanguage) {
  return sourceLanguage && sourceLanguage !== 'unknown'
    ? sourceLanguage
    : 'auto'
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
  const { i18n, t } = useTranslation()
  const originalDescription = String(book?.description || '').trim()
  const targetLanguage = getTargetLanguage(i18n.language)
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
        sourceLanguage: getCacheSourceLanguage(sourceLanguage),
        targetLanguage,
        description: originalDescription,
      }),
    [
      book?.googleBooksId,
      book?.id,
      book?.openLibraryId,
      book?.source,
      originalDescription,
      sourceLanguage,
      targetLanguage,
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
    hasDescription && sourceLanguage !== targetLanguage
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
      ? t(translationState.translationError)
      : ''
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
      const translationSourceLanguage =
        sourceLanguage === 'unknown' ? '' : sourceLanguage
      const translatedText = await translateText(
        originalDescription,
        translationSourceLanguage,
        targetLanguage
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
        translationError: 'bookPage.description.translationError',
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
    ? t('bookPage.description.showOriginal')
    : translatedDescription
      ? t('bookPage.description.showTranslation')
      : targetLanguage === 'en'
        ? t('bookPage.description.translateToEnglish')
        : t('bookPage.description.translateToFrench')

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
