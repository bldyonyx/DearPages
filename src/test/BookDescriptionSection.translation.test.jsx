import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import BookDescriptionSection from '../components/books/BookDescriptionSection.jsx'
import i18n from '../i18n/index.js'
import { translateText } from '../services/translationService.js'

vi.mock('../services/translationService.js', () => ({
  translateText: vi.fn(),
}))

const foreignDescriptions = {
  en: 'This English description has enough words to be clearly eligible for translation in the book page.',
  es: 'Esta descripcion en espanol tiene suficientes palabras para ser claramente elegible para la traduccion en la pagina del libro.',
  de: 'Diese deutsche Beschreibung hat genug Worte um eindeutig fuer die Uebersetzung auf der Buchseite geeignet zu sein.',
  it: 'Questa descrizione italiana contiene abbastanza parole per essere chiaramente idonea alla traduzione nella pagina del libro.',
}

const FRENCH_DESCRIPTION =
  'Ce resume francais contient assez de mots pour etre reconnu comme une description a traduire sur la page du livre.'

const UNKNOWN_SOURCE_DESCRIPTION =
  'Beschreibung ohne Metadaten mit genug Inhalt fuer eine automatische Erkennung durch den Uebersetzungsdienst.'

function createBook(overrides = {}) {
  return {
    googleBooksId: 'volume-1',
    source: 'google-books',
    language: 'en',
    description: foreignDescriptions.en,
    ...overrides,
  }
}

beforeEach(async () => {
  window.sessionStorage.clear()
  await i18n.changeLanguage('fr')
})

afterEach(async () => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
  await i18n.changeLanguage('fr')
})

describe('BookDescriptionSection translations', () => {
  it.each([
    ['English', 'en'],
    ['Spanish', 'es'],
    ['German', 'de'],
    ['Italian', 'it'],
  ])('translates %s descriptions to French', async (_, language) => {
    translateText.mockResolvedValue(
      `Description traduite depuis ${language}.`
    )

    render(
      <BookDescriptionSection
        book={createBook({
          googleBooksId: `volume-${language}`,
          language,
          description: foreignDescriptions[language],
        })}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Traduire en français',
      })
    )

    await waitFor(() => {
      expect(translateText).toHaveBeenCalledWith(
        foreignDescriptions[language],
        language,
        'fr'
      )
    })

    expect(
      await screen.findByText(
        `Description traduite depuis ${language}.`
      )
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Voir l’original' })
    ).toBeInTheDocument()
  })

  it.each([
    ['French', 'fr', FRENCH_DESCRIPTION],
    ['Spanish', 'es', foreignDescriptions.es],
    ['German', 'de', foreignDescriptions.de],
    ['Italian', 'it', foreignDescriptions.it],
  ])(
    'translates %s descriptions to English',
    async (_, language, description) => {
      await i18n.changeLanguage('en')
      translateText.mockResolvedValue(
        `English translation from ${language}.`
      )

      render(
        <BookDescriptionSection
          book={createBook({
            googleBooksId: `volume-${language}-en`,
            language,
            description,
          })}
        />
      )

      fireEvent.click(
        screen.getByRole('button', {
          name: 'Translate into English',
        })
      )

      await waitFor(() => {
        expect(translateText).toHaveBeenCalledWith(
          description,
          language,
          'en'
        )
      })

      expect(
        await screen.findByText(
          `English translation from ${language}.`
        )
      ).toBeInTheDocument()
      expect(
        screen.getByRole('button', { name: 'See the original' })
      ).toBeInTheDocument()
    }
  )

  it('does not offer translation when the description already matches the target language', async () => {
    await i18n.changeLanguage('en')

    render(<BookDescriptionSection book={createBook()} />)

    expect(
      screen.getByText(foreignDescriptions.en)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /translate/i,
      })
    ).not.toBeInTheDocument()
    expect(translateText).not.toHaveBeenCalled()
  })

  it('does not offer translation for descriptions already identified as French', () => {
    render(
      <BookDescriptionSection
        book={createBook({
          googleBooksId: 'volume-fr',
          language: 'fr',
          description:
            'Cette description française contient assez de mots pour être clairement reconnue comme déjà disponible en français.',
        })}
      />
    )

    expect(
      screen.queryByRole('button', {
        name: 'Traduire en français',
      })
    ).not.toBeInTheDocument()
    expect(translateText).not.toHaveBeenCalled()
  })

  it('updates the displayed summary when the interface language changes and reuses the matching cached translation', async () => {
    translateText.mockResolvedValue('Resume francais en cache.')

    render(<BookDescriptionSection book={createBook()} />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Traduire en français',
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText('Resume francais en cache.')
      ).toBeInTheDocument()
    })

    await act(async () => {
      await i18n.changeLanguage('en')
    })

    expect(
      screen.getByText(foreignDescriptions.en)
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Resume francais en cache.')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /translate/i,
      })
    ).not.toBeInTheDocument()

    await act(async () => {
      await i18n.changeLanguage('fr')
    })

    expect(
      screen.getByText('Resume francais en cache.')
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: 'Voir l’original',
      })
    ).toBeInTheDocument()

    expect(translateText).toHaveBeenCalledTimes(1)
  })

  it('uses provider auto-detection and cache for unknown source languages', async () => {
    translateText.mockResolvedValue('Resume auto-detecte.')

    const { unmount } = render(
      <BookDescriptionSection
        book={createBook({
          language: '',
          description: UNKNOWN_SOURCE_DESCRIPTION,
        })}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Traduire en français',
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText('Resume auto-detecte.')
      ).toBeInTheDocument()
    })

    expect(translateText).toHaveBeenCalledWith(
      UNKNOWN_SOURCE_DESCRIPTION,
      '',
      'fr'
    )

    unmount()

    render(
      <BookDescriptionSection
        book={createBook({
          language: '',
          description: UNKNOWN_SOURCE_DESCRIPTION,
        })}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Voir la traduction',
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText('Resume auto-detecte.')
      ).toBeInTheDocument()
    })

    expect(translateText).toHaveBeenCalledTimes(1)
  })

  it('keeps the original description available after translation', async () => {
    translateText.mockResolvedValue('Description traduite.')

    render(
      <BookDescriptionSection
        book={createBook({
          language: 'es',
          description: foreignDescriptions.es,
        })}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Traduire en français',
      })
    )

    expect(
      await screen.findByText('Description traduite.')
    ).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', { name: 'Voir l’original' })
    )

    expect(
      screen.getByText(foreignDescriptions.es)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Voir la traduction' })
    ).toBeInTheDocument()
  })

  it('shows only the friendly localized error when translation fails', async () => {
    const translationError = new Error('Translation request failed.')
    translationError.diagnostic = {
      status: 403,
      googleErrorCode: 403,
      googleErrorStatus: 'PERMISSION_DENIED',
      googleErrorMessage: 'API key restriction blocked this origin.',
      googleErrorReason: 'forbidden',
      origin: 'https://dear-pages-booktracker.web.app',
      hasApiKey: true,
      hasHttpResponse: true,
    }

    translateText.mockRejectedValue(translationError)

    render(<BookDescriptionSection book={createBook()} />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Traduire en français',
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'Impossible de traduire ce résumé pour le moment.'
        )
      ).toBeInTheDocument()
    })

    expect(screen.queryByText(/Diag temporaire/)).not.toBeInTheDocument()
    expect(screen.queryByText(/status=403/)).not.toBeInTheDocument()
    expect(screen.queryByText(/reason=forbidden/)).not.toBeInTheDocument()
    expect(
      screen.queryByText(/dear-pages-booktracker\.web\.app/)
    ).not.toBeInTheDocument()
  })
})
