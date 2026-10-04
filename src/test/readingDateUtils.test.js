import { describe, expect, it } from 'vitest'
import {
  createReadingTimestamp,
  formatReadingMonthYear,
  getReadingMonthYear,
  wasFinishedInYear,
} from '../utils/readingDateUtils'

describe('getReadingMonthYear', () => {
  it('extracts the month and year from a reading timestamp', () => {
    const timestamp = new Date(2026, 9, 15, 12).getTime()

    expect(getReadingMonthYear(timestamp)).toEqual({
      month: 9,
      year: 2026,
    })
  })

  it('returns null when no timestamp is provided', () => {
    expect(getReadingMonthYear(null)).toBeNull()
  })
})

describe('createReadingTimestamp', () => {
  it('creates a timestamp for the selected month and year', () => {
    const timestamp = createReadingTimestamp(9, 2026)
    const date = new Date(timestamp)

    expect(date.getMonth()).toBe(9)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getDate()).toBe(1)
  })

  it('returns null when the month or year is invalid', () => {
    expect(createReadingTimestamp('9', 2026)).toBeNull()
    expect(createReadingTimestamp(9, '2026')).toBeNull()
  })
})

describe('formatReadingMonthYear', () => {
  it('formats a reading timestamp in French', () => {
    const timestamp = new Date(2026, 9, 15, 12).getTime()

    expect(formatReadingMonthYear(timestamp)).toBe(
      'Octobre 2026'
    )
  })

  it('returns an empty string when no timestamp is provided', () => {
    expect(formatReadingMonthYear(null)).toBe('')
  })
})

describe('wasFinishedInYear', () => {
  it('returns true when the book was finished during the requested year', () => {
    const book = {
      finishedAt: new Date(2026, 5, 10, 12).getTime(),
    }

    expect(wasFinishedInYear(book, 2026)).toBe(true)
  })

  it('returns false when the book was finished during another year', () => {
    const book = {
      finishedAt: new Date(2025, 5, 10, 12).getTime(),
    }

    expect(wasFinishedInYear(book, 2026)).toBe(false)
  })

  it('returns false when the book has no finished date', () => {
    expect(wasFinishedInYear({}, 2026)).toBe(false)
  })
})