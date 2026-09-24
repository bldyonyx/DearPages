import { useEffect, useMemo, useState } from 'react'

import {
  isOpenLibraryCoverUrl,
  resolveOpenLibraryCoverByIsbn,
} from '../../services/coverUtils.js'

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
  const shouldTryOpenLibraryCover =
    Boolean(isbn) &&
    source !== 'open-library' &&
    !isOpenLibraryCoverUrl(usableCover)
  const coverStateKey = `${isbn || ''}|${usableCover || ''}|${
    source || ''
  }`
  const [openLibraryCoverState, setOpenLibraryCoverState] =
    useState({
      key: coverStateKey,
      cover: null,
    })
  const [failedCoverState, setFailedCoverState] = useState(
    () => ({
      key: coverStateKey,
      covers: new Set(),
    })
  )
  const openLibraryCover =
    openLibraryCoverState.key === coverStateKey
      ? openLibraryCoverState.cover
      : null
  const failedCovers =
    failedCoverState.key === coverStateKey
      ? failedCoverState.covers
      : new Set()

  useEffect(() => {
    let isActive = true

    if (!shouldTryOpenLibraryCover) {
      return () => {
        isActive = false
      }
    }

    resolveOpenLibraryCoverByIsbn(isbn).then((resolvedCover) => {
      if (isActive) {
        setOpenLibraryCoverState({
          key: coverStateKey,
          cover: resolvedCover,
        })
      }
    })

    return () => {
      isActive = false
    }
  }, [coverStateKey, isbn, shouldTryOpenLibraryCover])

  const coverCandidates = useMemo(
    () =>
      [openLibraryCover, usableCover].filter(
        (candidate, index, candidates) =>
          candidate && candidates.indexOf(candidate) === index
      ),
    [openLibraryCover, usableCover]
  )

  const visibleCover = coverCandidates.find(
    (candidate) => !failedCovers.has(candidate)
  )

  function handleCoverError() {
    if (!visibleCover) return

    setFailedCoverState((currentState) => {
      const nextCovers = new Set(
        currentState.key === coverStateKey
          ? currentState.covers
          : []
      )

      nextCovers.add(visibleCover)

      return {
        key: coverStateKey,
        covers: nextCovers,
      }
    })
  }

  return (
    <div className={className}>
      {visibleCover ? (
        <img
          src={visibleCover}
          alt={`Couverture de ${title}`}
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
