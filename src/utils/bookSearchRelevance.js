
const STRONG_TITLE_SCORE = 75
const STRONG_AUTHOR_SCORE = 85
const MIN_TITLE_SCORE = 55
const MIN_AUTHOR_SCORE = 85
const UNKNOWN_AUTHOR_TITLE_MATCH_PENALTY = 20

function normalizeIsbn(value) {
  return String(value || '').replace(/[^0-9xX]/g, '').toUpperCase()
}

function normalizeOpenLibraryWorkId(value) {
  const id = String(value || '').replace('/works/', '')
  return /^OL\d+W$/i.test(id) ? id.toUpperCase() : ''
}

function hasKnownAuthor(book) {
  return (book?.authors || []).some((author) => {
    const normalizedAuthor = normalizeSearchText(author)

    return (
      normalizedAuthor &&
      normalizedAuthor !== 'auteur inconnu' &&
      normalizedAuthor !== 'unknown author'
    )
  })
}

function hasDescription(book) {
  return String(book?.description || '').trim().length > 0
}

function getMetadataQualityBonus(book) {
  return (
    (book?.cover ? 3 : 0) +
    (hasKnownAuthor(book) ? 3 : 0) +
    (hasDescription(book) ? 2 : 0)
  )
}

function hasMinimumMetadataQuality(book) {
  return Boolean(book?.cover) || hasDescription(book)
}

export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function tokenizeSearchText(value) {
  const text = normalizeSearchText(value)
  return text ? text.split(/\s+/) : []
}

export function getNonInitialTokens(tokens) {
  return tokens.filter((token) => !/^[a-z]$/.test(token))
}

function isOrderedSubsequence(needles, haystack) {
  let from = 0

  return needles.every((needle) => {
    const index = haystack.indexOf(needle, from)
    if (index < 0) return false

    from = index + 1
    return true
  })
}

function scoreTextFieldRelevance(text, query, weight = 1) {
  const normalizedText = normalizeSearchText(text)
  const normalizedQuery = normalizeSearchText(query)
  const queryTokens = tokenizeSearchText(query)
  const textTokens = tokenizeSearchText(text)

  if (!normalizedText || !normalizedQuery || !queryTokens.length) return 0

  if (normalizedText === normalizedQuery) return 100 * weight
  if (normalizedText.startsWith(`${normalizedQuery} `)) return 90 * weight
  if (normalizedText.includes(` ${normalizedQuery} `)) return 82 * weight
  if (normalizedText.endsWith(` ${normalizedQuery}`)) return 78 * weight

  const tokenSet = new Set(textTokens)
  const matched = queryTokens.filter((token) => tokenSet.has(token)).length

  if (matched === queryTokens.length) {
    return (isOrderedSubsequence(queryTokens, textTokens) ? 70 : 60) * weight
  }

  return matched
    ? (30 + (matched / queryTokens.length) * 25) * weight
    : 0
}

function scoreSingleAuthor(author, query) {
  const authorTokens = tokenizeSearchText(author)
  const queryTokens = tokenizeSearchText(query)
  const authorWords = getNonInitialTokens(authorTokens)
  const queryWords = getNonInitialTokens(queryTokens)

  if (!authorTokens.length || !queryWords.length) return 0

  if (authorTokens.join(' ') === queryTokens.join(' ')) return 100

  if (authorWords.join(' ') === queryWords.join(' ')) {
    return queryTokens.length > queryWords.length ? 98 : 95
  }

  if (
    queryWords.length >= 2 &&
    authorWords[0] === queryWords[0] &&
    authorWords.at(-1) === queryWords.at(-1)
  ) {
    return 90
  }

  if (
    queryWords.length >= 2 &&
    isOrderedSubsequence(queryWords, authorWords)
  ) {
    return 82
  }

  if (queryWords.at(-1) === authorWords.at(-1)) {
    return queryWords.length === 1 ? 45 : 55
  }

  return 0
}

export function buildTitleSearchQuery(query) {
  const trimmed = String(query || '').trim()
  return trimmed ? `intitle:"${trimmed}"` : ''
}

export function buildTitleSearchQueries(query) {
  const trimmed = String(query || '').trim()
  const primaryQuery = buildTitleSearchQuery(trimmed)
  const normalizedQuery = normalizeSearchText(query)
  const shouldAddNormalizedQuery =
    normalizedQuery && normalizedQuery !== trimmed.toLowerCase()
  const normalizedTitleQuery = shouldAddNormalizedQuery
    ? buildTitleSearchQuery(normalizedQuery)
    : ''

  return Array.from(
    new Set([primaryQuery, normalizedTitleQuery].filter(Boolean))
  )
}

export function buildAuthorSearchQuery(query) {
  const terms = getNonInitialTokens(tokenizeSearchText(query))
  const surname = terms.at(-1)

  return terms.length >= 2 && surname
    ? `${terms.join(' ')} inauthor:${surname}`
    : ''
}

// Recherche explicite : "The Housemaid Freida McFadden".
export function splitTitleAndAuthor(query) {
  const tokens = tokenizeSearchText(query)

  if (tokens.length < 4) return null

  const title = tokens.slice(0, -2).join(' ')
  const authorTokens = tokens.slice(-2)

  const authorStopWords = new Set([
    'a',
    'an',
    'and',
    'de',
    'des',
    'du',
    'la',
    'le',
    'les',
    'of',
    'the',
  ])

  if (authorTokens.some((token) => authorStopWords.has(token))) {
    return null
  }

  const author = authorTokens.join(' ')
  return title && author ? { title, author } : null
}

// Permet aussi "Misery Stephen King".
// On ne valide le découpage que si un livre correspond
// réellement au titre ET à l'auteur.
export function getConfirmedTitleAuthorParts(books, query) {
  const tokens = tokenizeSearchText(query)

  if (tokens.length < 3) return null

  const title = tokens.slice(0, -2).join(' ')
  const author = tokens.slice(-2).join(' ')

  const stopWords = new Set([
    'a',
    'an',
    'and',
    'de',
    'des',
    'du',
    'la',
    'le',
    'les',
    'of',
    'the',
  ])

  if (!title || tokens.slice(-2).some((word) => stopWords.has(word))) {
    return null
  }

  const confirmed = books.some(
    (book) =>
      scoreTitleRelevance(book, title) >= STRONG_TITLE_SCORE &&
      scoreAuthorRelevance(book, author) >= 80
  )

  return confirmed ? { title, author } : null
}

// Détecte une recherche par auteur à partir des livres trouvés.
export function isConfirmedAuthorSearch(books, query) {
  const tokens = tokenizeSearchText(query)

  if (tokens.length < 2 || tokens.length > 3) return false

  return books.some(
    (book) => scoreAuthorRelevance(book, query) >= STRONG_AUTHOR_SCORE
  )
}

export function buildTitleAndAuthorSearchQuery(query) {
  const parts = splitTitleAndAuthor(query)

  if (!parts) return ''

  return `intitle:"${parts.title}" inauthor:${parts.author.split(' ').at(-1)}`
}

export function scoreTitleRelevance(book, query) {
  return Math.max(
    scoreTextFieldRelevance(book?.title, query),
    scoreTextFieldRelevance(book?.subtitle, query, 0.35)
  )
}

export function scoreAuthorRelevance(book, query) {
  return Math.max(
    0,
    ...(book?.authors || []).map((author) =>
      scoreSingleAuthor(author, query)
    )
  )
}

function scoreCandidate(book, query, intent = null) {
  const combined = intent?.combined || splitTitleAndAuthor(query)
  const unknownAuthorTitlePenalty = hasKnownAuthor(book)
    ? 0
    : UNKNOWN_AUTHOR_TITLE_MATCH_PENALTY

  if (combined) {
    const title = scoreTitleRelevance(book, combined.title)
    const author = scoreAuthorRelevance(book, combined.author)

    // Les deux champs doivent correspondre.
    if (title >= 75 && author >= 80) {
      return {
        titleScore: title,
        authorScore: author,
        score: 300 + title + author + getMetadataQualityBonus(book),
        isQualified: true,
      }
    }

    const fullTitleScore = scoreTitleRelevance(book, query)

    if (fullTitleScore >= STRONG_TITLE_SCORE) {
      return {
        titleScore: fullTitleScore,
        authorScore: author,
        score:
          fullTitleScore +
          100 +
          getMetadataQualityBonus(book) -
          unknownAuthorTitlePenalty,
        isQualified: true,
      }
    }

    return {
      titleScore: title,
      authorScore: author,
      score: 0,
      isQualified: false,
    }
  }

  const titleScore = scoreTitleRelevance(book, query)
  const authorScore = scoreAuthorRelevance(book, query)

  const languageBonus = book?.language === 'fr' ? 2 : 0
  const coverBonus = book?.cover ? 1 : 0

  const isTitleMatch = titleScore >= MIN_TITLE_SCORE
  const isAuthorMatch = authorScore >= MIN_AUTHOR_SCORE

  const authorSearch = intent?.authorOnly === true

  const exactTitleBonus =
    !authorSearch && titleScore >= 100 ? 200 : 0

  const strongTitleBonus =
    !authorSearch && titleScore >= STRONG_TITLE_SCORE ? 100 : 0

  const authorOnlyPenalty =
    !authorSearch && !isTitleMatch && isAuthorMatch ? -20 : 0

  const authorPriority =
    authorSearch && isAuthorMatch ? 300 : 0

  return {
    titleScore,
    authorScore,
    score:
      Math.max(titleScore, authorScore) +
      exactTitleBonus +
      strongTitleBonus +
      authorOnlyPenalty +
      authorPriority +
      languageBonus +
      coverBonus +
      getMetadataQualityBonus(book) -
      (!authorSearch && isTitleMatch ? unknownAuthorTitlePenalty : 0),
    isQualified: authorSearch
      ? isAuthorMatch
      : isTitleMatch || isAuthorMatch,
  }
}

export function scoreBookSearchRelevance(book, query, intent = null) {
  return scoreCandidate(book, query, intent)
}

export function hasStrongTitleMatch(books, query) {
  const parts = splitTitleAndAuthor(query)
  const titleQuery = parts ? parts.title : query

  return books.some(
    (book) =>
      scoreTitleRelevance(book, titleQuery) >= STRONG_TITLE_SCORE
  )
}

export function hasSufficientSearchMatches(books, query) {
  const parts = splitTitleAndAuthor(query)

  if (parts) {
    return books.some(
      (book) =>
        scoreTitleRelevance(book, parts.title) >= 75 &&
        scoreAuthorRelevance(book, parts.author) >= 85
    )
  }

  return books.some(
    (book) =>
      scoreTitleRelevance(book, query) >= STRONG_TITLE_SCORE ||
      scoreAuthorRelevance(book, query) >= STRONG_AUTHOR_SCORE
  )
}

export function getSearchBookIdentityKeys(book) {
  const googleBookId = book?.googleBooksId

  const openLibraryId = normalizeOpenLibraryWorkId(
    book?.openLibraryId || book?.id
  )

  const isbnKeys = [...(book?.isbns || []), book?.isbn]
    .map(normalizeIsbn)
    .filter(Boolean)
    .map((isbn) => `isbn:${isbn}`)

  const title = normalizeSearchText(book?.title)
  const author = normalizeSearchText(book?.authors?.[0])

  return [
    googleBookId ? `google:${googleBookId}` : '',
    openLibraryId ? `openlibrary:${openLibraryId}` : '',
    ...isbnKeys,
    title && author ? `title-author:${title}:${author}` : '',
  ].filter(Boolean)
}

function mergeSearchBook(currentBook, nextBook) {
  return {
    ...nextBook,
    ...currentBook,

    googleBooksId:
      currentBook.googleBooksId || nextBook.googleBooksId,

    openLibraryId:
      currentBook.openLibraryId || nextBook.openLibraryId,

    isbn: currentBook.isbn || nextBook.isbn || null,

    isbns: Array.from(
      new Set([
        ...(currentBook.isbns || []),
        ...(nextBook.isbns || []),
      ])
    ),

    cover: currentBook.cover || nextBook.cover || null,

    description:
      currentBook.description || nextBook.description || '',

    categories:
      currentBook.categories?.length > 0
        ? currentBook.categories
        : nextBook.categories || [],

    publishedDate:
      currentBook.publishedDate || nextBook.publishedDate || '',

    source:
      currentBook.source === nextBook.source
        ? currentBook.source
        : currentBook.source || nextBook.source,
  }
}

export function mergeAndRankSearchBooks(
  candidateGroups,
  query,
  limit,
  intent = null
) {
  const seenKeysToIndex = new Map()
  const unique = []

  candidateGroups.flat().forEach((book, originalIndex) => {
    if (!hasMinimumMetadataQuality(book)) return

    const relevance = scoreBookSearchRelevance(book, query, intent)

    if (!relevance.isQualified) return

    const keys = getSearchBookIdentityKeys(book)

    const existingIndex = keys
      .map((key) => seenKeysToIndex.get(key))
      .find((index) => index !== undefined)

    if (existingIndex !== undefined) {
      const existing = unique[existingIndex]
      const mergedBook = mergeSearchBook(existing.book, book)

      const mergedRelevance = scoreBookSearchRelevance(
        mergedBook,
        query,
        intent
      )

      unique[existingIndex] = {
        ...existing,
        book: mergedBook,
        relevance:
          mergedRelevance.score > existing.relevance.score
            ? mergedRelevance
            : existing.relevance,
      }

      keys.forEach((key) =>
        seenKeysToIndex.set(key, existingIndex)
      )

      return
    }

    const nextIndex = unique.length

    keys.forEach((key) =>
      seenKeysToIndex.set(key, nextIndex)
    )

    unique.push({
      book,
      originalIndex,
      relevance,
    })
  })

  return unique
    .sort(
      (a, b) =>
        b.relevance.score - a.relevance.score ||
        b.relevance.titleScore - a.relevance.titleScore ||
        b.relevance.authorScore - a.relevance.authorScore ||
        a.originalIndex - b.originalIndex
    )
    .slice(0, limit)
    .map(({ book }) => book)
}
