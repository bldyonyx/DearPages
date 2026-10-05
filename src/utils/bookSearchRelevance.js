const STRONG_TITLE_SCORE = 75
const STRONG_AUTHOR_SCORE = 85

function normalizeIsbn(value) {
  return String(value || '')
    .replace(/[^0-9xX]/g, '')
    .toUpperCase()
}

function isOrderedSubsequence(needles, haystack) {
  let searchFrom = 0

  return needles.every((needle) => {
    const foundIndex = haystack.indexOf(needle, searchFrom)

    if (foundIndex === -1) return false

    searchFrom = foundIndex + 1
    return true
  })
}

function countTokenMatches(queryTokens, textTokens) {
  const textTokenSet = new Set(textTokens)

  return queryTokens.filter((token) => textTokenSet.has(token)).length
}

function scoreTextFieldRelevance(text, query, weight = 1) {
  const normalizedText = normalizeSearchText(text)
  const normalizedQuery = normalizeSearchText(query)
  const queryTokens = tokenizeSearchText(query)
  const textTokens = tokenizeSearchText(text)

  if (!normalizedText || !normalizedQuery || !queryTokens.length) {
    return 0
  }

  if (normalizedText === normalizedQuery) return 100 * weight
  if (normalizedText.startsWith(`${normalizedQuery} `)) {
    return 90 * weight
  }
  if (normalizedText.includes(` ${normalizedQuery} `)) {
    return 82 * weight
  }
  if (normalizedText.endsWith(` ${normalizedQuery}`)) {
    return 78 * weight
  }

  const matchedTokens = countTokenMatches(queryTokens, textTokens)

  if (matchedTokens === queryTokens.length) {
    if (isOrderedSubsequence(queryTokens, textTokens)) {
      return 70 * weight
    }

    return 60 * weight
  }

  if (matchedTokens > 0) {
    return (30 + (matchedTokens / queryTokens.length) * 25) * weight
  }

  return 0
}

function scoreSingleAuthor(author, query) {
  const authorTokens = tokenizeSearchText(author)
  const queryTokens = tokenizeSearchText(query)
  const authorWithoutInitials = getNonInitialTokens(authorTokens)
  const queryWithoutInitials = getNonInitialTokens(queryTokens)
  const normalizedAuthor = authorTokens.join(' ')
  const normalizedQuery = queryTokens.join(' ')
  const comparableAuthor = authorWithoutInitials.join(' ')
  const comparableQuery = queryWithoutInitials.join(' ')

  if (
    !authorTokens.length ||
    !queryTokens.length ||
    !queryWithoutInitials.length
  ) {
    return 0
  }

  if (normalizedAuthor === normalizedQuery) return 100
  if (comparableAuthor && comparableAuthor === comparableQuery) {
    return queryTokens.length > queryWithoutInitials.length ? 98 : 95
  }

  const authorFirst = authorWithoutInitials[0]
  const authorLast = authorWithoutInitials.at(-1)
  const queryFirst = queryWithoutInitials[0]
  const queryLast = queryWithoutInitials.at(-1)

  if (
    queryWithoutInitials.length >= 2 &&
    authorFirst === queryFirst &&
    authorLast === queryLast
  ) {
    return 90
  }

  if (
    queryWithoutInitials.length >= 2 &&
    isOrderedSubsequence(queryWithoutInitials, authorWithoutInitials)
  ) {
    return 82
  }

  if (queryLast && authorLast === queryLast) {
    return queryWithoutInitials.length === 1 ? 45 : 55
  }

  return 0
}

/**
 * Normalizes user search text for explainable title and author comparison.
 * Accents, punctuation, and repeated whitespace are removed, while initials
 * remain as single-letter tokens for author matching.
 *
 * @param {string} value - Text to normalize.
 * @returns {string} Lowercase, accent-free, whitespace-normalized text.
 */
export function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/**
 * Splits normalized search text into whole-word tokens.
 *
 * @param {string} value - Text to tokenize.
 * @returns {Array<string>} Normalized tokens.
 */
export function tokenizeSearchText(value) {
  const normalizedText = normalizeSearchText(value)

  return normalizedText ? normalizedText.split(/\s+/) : []
}

export function getNonInitialTokens(tokens) {
  return tokens.filter((token) => !/^[a-z]$/.test(token))
}

export function buildTitleSearchQuery(query) {
  const trimmedQuery = String(query || '').trim()

  return trimmedQuery ? `intitle:"${trimmedQuery}"` : ''
}

export function buildAuthorSearchQuery(query) {
  const tokens = tokenizeSearchText(query)
  const terms = getNonInitialTokens(tokens)
  const surname = terms.at(-1)

  if (terms.length < 2 || !surname) return ''

  return `${terms.join(' ')} inauthor:${surname}`
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

export function scoreBookSearchRelevance(book, query) {
  const titleScore = scoreTitleRelevance(book, query)
  const authorScore = scoreAuthorRelevance(book, query)
  const languageBonus = book?.language === 'fr' ? 2 : 0
  const coverBonus = book?.cover ? 1 : 0

  return {
    titleScore,
    authorScore,
    score: Math.max(titleScore, authorScore) + languageBonus + coverBonus,
  }
}

export function hasSufficientSearchMatches(books, query) {
  return books.some((book) => {
    const titleScore = scoreTitleRelevance(book, query)
    const authorScore = scoreAuthorRelevance(book, query)

    return (
      titleScore >= STRONG_TITLE_SCORE ||
      authorScore >= STRONG_AUTHOR_SCORE
    )
  })
}

export function getSearchBookIdentityKeys(book) {
  const googleBookId = book?.googleBooksId || book?.id
  const isbnKeys = [...(book?.isbns || []), book?.isbn]
    .map(normalizeIsbn)
    .filter(Boolean)
    .map((isbn) => `isbn:${isbn}`)
  const title = normalizeSearchText(book?.title)
  const primaryAuthor = normalizeSearchText(book?.authors?.[0])
  const titleAuthorKey =
    title && primaryAuthor
      ? `title-author:${title}:${primaryAuthor}`
      : ''

  return [
    googleBookId ? `google:${googleBookId}` : '',
    ...isbnKeys,
    titleAuthorKey,
  ].filter(Boolean)
}

export function mergeAndRankSearchBooks(candidateGroups, query, limit) {
  const seenIdentityKeys = new Set()
  const uniqueBooks = []

  candidateGroups.flat().forEach((book, originalIndex) => {
    const identityKeys = getSearchBookIdentityKeys(book)
    const isDuplicate = identityKeys.some((key) =>
      seenIdentityKeys.has(key)
    )

    if (isDuplicate) return

    identityKeys.forEach((key) => seenIdentityKeys.add(key))
    uniqueBooks.push({ book, originalIndex })
  })

  return uniqueBooks
    .map(({ book, originalIndex }) => ({
      book,
      originalIndex,
      relevance: scoreBookSearchRelevance(book, query),
    }))
    .sort((left, right) => {
      const scoreDifference =
        right.relevance.score - left.relevance.score
      if (scoreDifference) return scoreDifference

      const titleDifference =
        right.relevance.titleScore - left.relevance.titleScore
      if (titleDifference) return titleDifference

      const authorDifference =
        right.relevance.authorScore - left.relevance.authorScore
      if (authorDifference) return authorDifference

      return left.originalIndex - right.originalIndex
    })
    .slice(0, limit)
    .map(({ book }) => book)
}
