import { describe, expect, it } from 'vitest'

import { detectDescriptionLanguage } from '../utils/descriptionLanguage.js'

describe('detectDescriptionLanguage', () => {
  it.each([
    ['en', 'en'],
    ['en-US', 'en'],
    ['es', 'es'],
    ['de', 'de'],
    ['it', 'it'],
    ['pt-BR', 'pt'],
  ])('preserves explicit metadata language %s', (metadata, expected) => {
    expect(
      detectDescriptionLanguage(
        'Short metadata-backed description.',
        metadata
      )
    ).toBe(expected)
  })

  it('detects French text without metadata', () => {
    expect(
      detectDescriptionLanguage(
        'Cette histoire avec des personnages attachants est une aventure qui explore leur famille, leurs secrets et les choix pour demain.',
        ''
      )
    ).toBe('fr')
  })

  it('detects English text without metadata', () => {
    expect(
      detectDescriptionLanguage(
        'This story follows the lives of their family and the choices that bring them from grief to hope with courage.',
        ''
      )
    ).toBe('en')
  })

  it('keeps uncertain text unknown without metadata', () => {
    expect(
      detectDescriptionLanguage(
        'Ord er stille spor gennem byen mens mennesker venter under lysene ved havnen uden klare tegn.',
        ''
      )
    ).toBe('unknown')
  })
})
