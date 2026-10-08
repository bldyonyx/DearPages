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

const READING_MONTHS_EN = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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

export function formatReadingMonthYear(timestamp, language = 'fr') {
  const date = getReadingMonthYear(timestamp)

  if (!date) {
    return ''
  }

  const months =
    String(language).slice(0, 2) === 'en'
      ? READING_MONTHS_EN
      : READING_MONTHS

  return `${months[date.month]} ${date.year}`
}

export function wasFinishedInYear(book, year) {
  if (!book?.finishedAt) {
    return false
  }

  return (
    new Date(book.finishedAt).getFullYear() === year
  )
}
