const EXPLICIT_DISCOVERY_CLASSIFICATIONS = new Set([
  'erotica',
  'erotic literature',
  'erotic stories american',
  'american erotic stories',
  'fiction erotica',
  'fiction erotica general',
  'fiction romance erotic',
  'fiction romance erotica',
  'pornographic fiction',
  'pornography',
])

function normalizeClassification(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[,&/]+/g, ' ')
    .replace(/[^a-z0-9:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isContentWarningClassification(value) {
  const compactValue = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')

  return (
    compactValue.startsWith('content_warning:') ||
    compactValue.startsWith('contentwarning:')
  )
}

function getDiscoveryClassifications(book) {
  return [
    ...(book?.categories || []),
    ...(book?.subject || []),
    ...(book?.subjects || []),
    ...(book?.subject_key || []),
    ...(book?.subjectKeys || []),
  ]
}

export function isExplicitDiscoveryBook(book) {
  return getDiscoveryClassifications(book).some((classification) => {
    if (isContentWarningClassification(classification)) {
      return true
    }

    return EXPLICIT_DISCOVERY_CLASSIFICATIONS.has(
      normalizeClassification(classification)
    )
  })
}
