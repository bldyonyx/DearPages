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

const ENGLISH_DESCRIPTION =
  'This English description has enough words to be clearly eligible for translation in the book page.'

const FRENCH_DESCRIPTION =
  'Ce resume francais contient assez de mots pour etre reconnu comme une description a traduire sur la page du livre.'

const GERMAN_DESCRIPTION =
  'Diese deutsche Beschreibung enthaelt genug Woerter, damit sie als Buchzusammenfassung in eine andere Sprache uebersetzt werden kann.'

const SPANISH_DESCRIPTION =
  'Esta descripcion espanola contiene suficientes palabras para traducirse correctamente dentro de la pagina del libro.'

const UNKNOWN_SOURCE_DESCRIPTION =
  'Beschreibung ohne Metadaten mit genug Inhalt fuer eine automatische Erkennung durch den Uebersetzungsdienst.'

function createBook(overrides = {}) {
  return {
    googleBooksId: 'volume-1',
    source: 'google-books',
    language: 'en',
    description: ENGLISH_DESCRIPTION,
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
  it('translates a French description into English', async () => {
    await i18n.changeLanguage('en')
    translateText.mockResolvedValue('English translated summary.')

    render(
      <BookDescriptionSection
        book={createBook({
          language: 'fr',
          description: FRENCH_DESCRIPTION,
        })}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Translate into English',
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText('English translated summary.')
      ).toBeInTheDocument()
    })

    expect(translateText).toHaveBeenCalledWith(
      FRENCH_DESCRIPTION,
      'fr',
      'en'
    )
  })

  it('translates an English description into French', async () => {
    translateText.mockResolvedValue('Resume traduit en francais.')

    render(<BookDescriptionSection book={createBook()} />)

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Traduire en français',
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText('Resume traduit en francais.')
      ).toBeInTheDocument()
    })

    expect(translateText).toHaveBeenCalledWith(
      ENGLISH_DESCRIPTION,
      'en',
      'fr'
    )
  })

  it('translates a German description into French', async () => {
    translateText.mockResolvedValue('Resume allemand traduit.')

    render(
      <BookDescriptionSection
        book={createBook({
          language: 'de',
          description: GERMAN_DESCRIPTION,
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
        screen.getByText('Resume allemand traduit.')
      ).toBeInTheDocument()
    })

    expect(translateText).toHaveBeenCalledWith(
      GERMAN_DESCRIPTION,
      'de',
      'fr'
    )
  })

  it('translates a Spanish description into English', async () => {
    await i18n.changeLanguage('en')
    translateText.mockResolvedValue('Spanish summary translated.')

    render(
      <BookDescriptionSection
        book={createBook({
          language: 'es',
          description: SPANISH_DESCRIPTION,
        })}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Translate into English',
      })
    )

    await waitFor(() => {
      expect(
        screen.getByText('Spanish summary translated.')
      ).toBeInTheDocument()
    })

    expect(translateText).toHaveBeenCalledWith(
      SPANISH_DESCRIPTION,
      'es',
      'en'
    )
  })

  it('does not offer translation when the description already matches the target language', async () => {
    await i18n.changeLanguage('en')

    render(<BookDescriptionSection book={createBook()} />)

    expect(
      screen.getByText(ENGLISH_DESCRIPTION)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /translate/i,
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
      screen.getByText(ENGLISH_DESCRIPTION)
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

  it('shows only the friendly error when translation fails', async () => {
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
