import { useEffect, useMemo, useState } from 'react'

import {
  getCachedOpenLibraryCoverByIsbn,
  OPEN_LIBRARY_COVER_CACHE_STATUS,
  isOpenLibraryCoverUrl,
  resolveOpenLibraryCoverByIsbn,
} from '../../services/coverUtils.js'

const BOOK_COVER_INTRINSIC_WIDTH = 200
const BOOK_COVER_INTRINSIC_HEIGHT = 300

function isGooglePlaceholderCover(coverUrl) {
  if (!coverUrl) return false

  try {
    const urlText = new URL(coverUrl).toString().toLowerCase()

    return (
      urlText.includes('/googlebooks/images/no_cover') ||
      urlText.includes('no_cover_thumb') ||
      urlText.includes('image_not_available')
    )
  } catch {
    return false
  }
}

function getUsableCover(coverUrl) {
  return coverUrl && !isGooglePlaceholderCover(coverUrl)
    ? coverUrl
    : null
}

function BookCover({
  title,
  cover,
  isbn,
  source,
  coverLoading = 'lazy',
  className = '',
  imageClassName = '',
  fallback = 'placeholder',
  titleClassName = 'font-heading text-lg font-bold leading-snug text-darkwood',
}) {
  const usableCover = getUsableCover(cover)
  const openLibraryResolutionKey = `${isbn || ''}|${
    source || ''
  }`
  const failedCoverKey = `${openLibraryResolutionKey}|${
    usableCover || ''
  }`

  const [failedCoverState, setFailedCoverState] = useState({
    key: failedCoverKey,
    covers: new Set(),
  })
  const [, setCacheVersion] = useState(0)
  const failedCovers =
    failedCoverState.key === failedCoverKey
      ? failedCoverState.covers
      : new Set()
  const hasUsableCoverFailed =
    Boolean(usableCover) && failedCovers.has(usableCover)
  const shouldTryOpenLibraryCover =
    Boolean(isbn) &&
    source !== 'open-library' &&
    !isOpenLibraryCoverUrl(usableCover) &&
    (!usableCover || hasUsableCoverFailed)
  const cachedOpenLibraryCover =
    shouldTryOpenLibraryCover
      ? getCachedOpenLibraryCoverByIsbn(isbn)
      : null
  const hasResolvedOpenLibraryCover =
    cachedOpenLibraryCover?.status ===
    OPEN_LIBRARY_COVER_CACHE_STATUS.RESOLVED
  const hasMissingOpenLibraryCover =
    cachedOpenLibraryCover?.status ===
    OPEN_LIBRARY_COVER_CACHE_STATUS.MISSING
  const isOpenLibraryResolved =
    !shouldTryOpenLibraryCover ||
    hasResolvedOpenLibraryCover ||
    hasMissingOpenLibraryCover
  const openLibraryCover = hasResolvedOpenLibraryCover
    ? cachedOpenLibraryCover.cover
    : null

  useEffect(() => {
    let isActive = true

    if (!shouldTryOpenLibraryCover || isOpenLibraryResolved) {
      return () => {
        isActive = false
      }
    }

    resolveOpenLibraryCoverByIsbn(isbn).then(() => {
      if (!isActive) {
        return
      }

      setCacheVersion((currentVersion) => currentVersion + 1)
    })

    return () => {
      isActive = false
    }
  }, [
    isOpenLibraryResolved,
    isbn,
    openLibraryResolutionKey,
    shouldTryOpenLibraryCover,
  ])

  const coverCandidates = useMemo(() => {
    return [openLibraryCover, usableCover].filter(
      (candidate, index, candidates) =>
        candidate && candidates.indexOf(candidate) === index
    )
  }, [
    openLibraryCover,
    usableCover,
  ])

  const visibleCover = coverCandidates.find(
    (candidate) => !failedCovers.has(candidate)
  )

  function handleCoverError() {
    if (!visibleCover) return

    setFailedCoverState((currentState) => {
      const nextCovers = new Set(
        currentState.key === failedCoverKey
          ? currentState.covers
          : []
      )

      nextCovers.add(visibleCover)

      return {
        key: failedCoverKey,
        covers: nextCovers,
      }
    })
  }

  const isResolvingCover =
    shouldTryOpenLibraryCover && !isOpenLibraryResolved

  return (
    <div className={className}>
      {isResolvingCover && !visibleCover ? (
        <div
          className="
            h-full w-full
            animate-pulse
            rounded-[inherit]
            bg-sage/15
          "
          aria-label={`Chargement de la couverture de ${title}`}
        />
      ) : visibleCover ? (
        <img
          src={visibleCover}
          alt={`Couverture de ${title}`}
          width={BOOK_COVER_INTRINSIC_WIDTH}
          height={BOOK_COVER_INTRINSIC_HEIGHT}
          loading={coverLoading}
          decoding="async"
          onError={handleCoverError}
          className={imageClassName}
        />
      ) : fallback === 'title' ? (
        <div className="flex h-full w-full items-center justify-center p-5 text-center">
          <span className={titleClassName}>
            {title}
          </span>
        </div>
      ) : (
        <div
          className="
            relative flex h-full w-full items-center justify-center
            bg-sage/20 p-4
          "
        >
          <div className="absolute inset-2 rounded-lg border border-olive/20" />

          <div className="relative text-center">
            <span
              aria-hidden="true"
              className="font-heading text-3xl text-olive/40"
            >
              ♡
            </span>

            <p className="mt-3 font-ui text-[10px] leading-relaxed text-darkwood/40">
              Couverture
              <br />
              indisponible
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default BookCover
