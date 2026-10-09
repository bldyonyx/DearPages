
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronRight, Languages, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { discoverBookEditions } from '../../services/books/bookEditionsDiscovery.js'
import { getBookRouteId } from '../../utils/bookPageUtils.js'

const PAGE_SIZE = 12

function getCover(edition) {
  if (edition.cover) return edition.cover

  return edition.coverId
    ? `https://covers.openlibrary.org/b/id/${edition.coverId}-M.jpg?default=false`
    : null
}

function BookEditionsSection({ book, isOpen, onClose }) {
  const { i18n } = useTranslation()
  const navigate = useNavigate()
  const isFrench = i18n.language?.startsWith('fr')

  const [language, setLanguage] = useState('fr')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const bookId = getBookRouteId(book)

  useEffect(() => {
    if (!isOpen) return

    function handleEscape(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  useEffect(() => {
    setResult(null)
    setError(false)
    setVisibleCount(PAGE_SIZE)
  }, [bookId])

  useEffect(() => {
    if (!isOpen || !book || result || error) return

    let cancelled = false

    async function load() {
      setLoading(true)

      try {
        const data = await discoverBookEditions(book)

        if (!cancelled) setResult(data)
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()

    return () => {
      cancelled = true
    }
  }, [isOpen, bookId, result, error, book])

  if (!isOpen) return null

  const allEditions = result?.editions || []
  const editions = allEditions.filter(
    (edition) => edition.language === language
  )

  const counts = {
    fr: allEditions.filter((edition) => edition.language === 'fr').length,
    en: allEditions.filter((edition) => edition.language === 'en').length,
  }

  function openEdition(edition) {
    const isOpenLibrary = edition.source === 'open-library'

    const selectedBook = {
      id: edition.id,
      googleBooksId: isOpenLibrary
        ? null
        : edition.googleBooksId || edition.id,
      openLibraryEditionId: isOpenLibrary
        ? edition.openLibraryEditionId || edition.id
        : null,
      openLibraryId:
        isOpenLibrary && result?.workId
          ? `/works/${result.workId}`
          : null,
      title: edition.title,
      authors: book.authors,
      isbn: edition.isbn,
      isbns: edition.isbns,
      cover: getCover(edition),
      publishedDate: edition.publishedDate,
      language: edition.language,
      categories: [],
      description: '',
      source: edition.source,
    }

    onClose()

    navigate(`/books/${edition.id}`, {
      state: { book: selectedBook },
    })
  }

  return createPortal(
    <div
      className="fixed inset-0 z-100 flex items-center justify-center bg-darkwood/45 p-4 sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="book-editions-title"
        className="flex max-h-[min(85vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-darkwood/10 bg-cream shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-darkwood/10 px-5 py-5 sm:px-7">
          <div className="flex min-w-0 items-start gap-3">
            <Languages
              size={21}
              strokeWidth={1.6}
              className="mt-1 shrink-0 text-walnut"
            />

            <div>
              <h2
                id="book-editions-title"
                className="font-heading text-2xl font-bold text-darkwood"
              >
                {isFrench ? 'Les autres éditions' : 'Other editions'}
              </h2>

              <p className="mt-1 font-ui text-xs text-walnut/70">
                {isFrench
                  ? 'Explore les différentes versions de ce livre.'
                  : 'Explore different versions of this book.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isFrench ? 'Fermer' : 'Close'}
            className="rounded-full p-2 text-walnut transition hover:bg-darkwood/5"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex gap-2 border-b border-darkwood/10 px-5 py-4 sm:px-7">
          {[
            { value: 'fr', label: 'Français' },
            { value: 'en', label: 'English' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={language === option.value}
              onClick={() => {
                setLanguage(option.value)
                setVisibleCount(PAGE_SIZE)
              }}
              className={`rounded-full border px-4 py-2 font-ui text-xs transition ${
                language === option.value
                  ? 'border-darkwood bg-darkwood text-cream'
                  : 'border-darkwood/15 text-walnut hover:border-darkwood/40'
              }`}
            >
              {option.label}
              {result && ` (${counts[option.value]})`}
            </button>
          ))}
        </div>

        <div className="min-h-32 flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          {loading && (
            <p role="status" className="font-ui text-sm text-walnut/70">
              {isFrench
                ? 'Recherche des éditions…'
                : 'Finding editions…'}
            </p>
          )}

          {error && (
            <p role="alert" className="font-ui text-sm text-walnut">
              {isFrench
                ? 'Impossible de charger les éditions.'
                : 'Unable to load editions.'}
            </p>
          )}

          {!loading && !error && result && editions.length === 0 && (
            <p className="font-ui text-sm text-walnut/70">
              {isFrench
                ? 'Aucune édition trouvée dans cette langue.'
                : 'No editions found in this language.'}
            </p>
          )}

          {!loading && !error && editions.length > 0 && (
            <>
              <div className="grid gap-2 sm:grid-cols-2">
                {editions.slice(0, visibleCount).map((edition) => {
                  const current = edition.id === bookId
                  const cover = getCover(edition)

                  return (
                    <button
                      key={`${edition.source}-${edition.id}`}
                      type="button"
                      disabled={current}
                      onClick={() => openEdition(edition)}
                      className={`flex min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        current
                          ? 'cursor-default border-forest/30 bg-forest/10'
                          : 'border-darkwood/10 bg-parchment/40 hover:border-walnut/40 hover:bg-parchment/70'
                      }`}
                    >
                      <div className="h-18 w-12 shrink-0 overflow-hidden rounded-md bg-parchment">
                        {cover ? (
                          <img
                            src={cover}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-walnut/40">
                            <Languages size={17} />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 font-heading text-sm font-bold text-darkwood">
                          {edition.title}
                        </p>

                        {edition.publishedDate && (
                          <p className="mt-1 font-ui text-xs text-walnut/65">
                            {edition.publishedDate}
                          </p>
                        )}

                        {edition.publishers?.length > 0 && (
                          <p className="mt-1 truncate font-ui text-xs text-walnut/65">
                            {edition.publishers.join(', ')}
                          </p>
                        )}

                        {current && (
                          <p className="mt-1 font-ui text-xs text-forest">
                            {isFrench
                              ? 'Édition actuelle'
                              : 'Current edition'}
                          </p>
                        )}
                      </div>

                      {!current && (
                        <ChevronRight
                          size={16}
                          className="shrink-0 text-walnut/50"
                        />
                      )}
                    </button>
                  )
                })}
              </div>

              {visibleCount < editions.length && (
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((count) => count + PAGE_SIZE)
                  }
                  className="mt-5 font-ui text-sm text-walnut underline underline-offset-4"
                >
                  {isFrench ? 'Voir plus' : 'Show more'}
                </button>
              )}
            </>
          )}
        </div>
      </section>
    </div>,
    document.body
  )
}

export default BookEditionsSection
