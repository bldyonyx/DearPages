export const READING_MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]

export function getReadingMonthYear(timestamp) {
  if (!timestamp) {
    return null
  }

  const date = new Date(timestamp)

  return {
    month: date.getMonth(),
    year: date.getFullYear(),
  }
}

export function createReadingTimestamp(month, year) {
  if (
    !Number.isInteger(month) ||
    !Number.isInteger(year)
  ) {
    return null
  }

  return new Date(year, month, 1, 12).getTime()
}

export function formatReadingMonthYear(timestamp) {
  const date = getReadingMonthYear(timestamp)

  if (!date) {
    return ''
  }

  return `${READING_MONTHS[date.month]} ${date.year}`
}

export function wasFinishedInYear(book, year) {
  if (!book?.finishedAt) {
    return false
  }

  return (
    new Date(book.finishedAt).getFullYear() === year
  )
}