import { describe, expect, it } from 'vitest'
import { isExplicitDiscoveryBook } from '../utils/discoveryContentSafety'

describe('isExplicitDiscoveryBook', () => {
  it.each([
    ['content warning cover', { subjects: ['content_warning:cover'] }],
    ['erotica', { categories: ['Erotica'] }],
    ['erotic literature', { subjects: ['Erotic Literature'] }],
    [
      'fiction romance erotic',
      { subjects: ['Fiction, romance, erotic'] },
    ],
    [
      'fiction romance erotica',
      { subjects: ['Fiction, romance, erotica'] },
    ],
    ['pornographic fiction', { subjects: ['Pornographic Fiction'] }],
    [
      'normalized erotic subject key',
      { subjectKeys: ['fiction_romance_erotic'] },
    ],
    [
      'normalized erotica subject key',
      { subject_key: ['fiction_romance_erotica'] },
    ],
    [
      'normalized pornographic subject key',
      { subject_key: ['pornographic_fiction'] },
    ],
  ])('marks %s as explicit', (_label, book) => {
    expect(isExplicitDiscoveryBook(book)).toBe(true)
  })

  it.each([
    ['romance', { categories: ['Romance'] }],
    ['romance fiction', { subjects: ['Romance fiction'] }],
    ['love stories', { subjects: ['Love stories'] }],
    ['relationships', { categories: ['Relationships'] }],
    ['marriage', { subjects: ['Marriage'] }],
    ['sexuality', { subjects: ['Sexuality'] }],
    ['sex education', { subjects: ['Sex education'] }],
    ['health', { categories: ['Health'] }],
    [
      'normal romantasy categories',
      { categories: ['Romance', 'Fantasy', 'Romantasy'] },
    ],
  ])('allows %s', (_label, book) => {
    expect(isExplicitDiscoveryBook(book)).toBe(false)
  })
})
