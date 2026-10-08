import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BookDescriptionSection from '../components/books/BookDescriptionSection.jsx'
import { translateText } from '../services/translationService.js'

vi.mock('../services/translationService.js', () => ({
  translateText: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
  window.sessionStorage.clear()
})

const foreignDescriptions = {
  en: 'This English description has enough words to be clearly eligible for translation in the book page.',
  es: 'Esta descripcion en espanol tiene suficientes palabras para ser claramente elegible para la traduccion en la pagina del libro.',
  de: 'Diese deutsche Beschreibung hat genug Worte um eindeutig fuer die Uebersetzung auf der Buchseite geeignet zu sein.',
  it: 'Questa descrizione italiana contiene abbastanza parole per essere chiaramente idonea alla traduzione nella pagina del libro.',
}

describe('BookDescriptionSection translation', () => {
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
        book={{
          googleBooksId: `volume-${language}`,
          source: 'google-books',
          language,
          description: foreignDescriptions[language],
        }}
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
      await screen.findByText(`Description traduite depuis ${language}.`)
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Voir l’original' })
    ).toBeInTheDocument()
  })

  it('does not offer translation for descriptions already identified as French', () => {
    render(
      <BookDescriptionSection
        book={{
          googleBooksId: 'volume-fr',
          source: 'google-books',
          language: 'fr',
          description:
            'Cette description française contient assez de mots pour être clairement reconnue comme déjà disponible en français.',
        }}
      />
    )

    expect(
      screen.queryByRole('button', {
        name: 'Traduire en français',
      })
    ).not.toBeInTheDocument()
    expect(translateText).not.toHaveBeenCalled()
  })

  it('lets the API auto-detect unknown source languages', async () => {
    const description =
      'Ord er små spor gennem en stille by hvor ingen helt ved hvilken historie der bliver fortalt.'

    translateText.mockResolvedValue('Description traduite automatiquement.')

    render(
      <BookDescriptionSection
        book={{
          googleBooksId: 'volume-unknown',
          source: 'google-books',
          language: '',
          description,
        }}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Traduire en français',
      })
    )

    await waitFor(() => {
      expect(translateText).toHaveBeenCalledWith(
        description,
        '',
        'fr'
      )
    })
  })

  it('keeps the original description available after translation', async () => {
    translateText.mockResolvedValue('Description traduite.')

    render(
      <BookDescriptionSection
        book={{
          googleBooksId: 'volume-original-toggle',
          source: 'google-books',
          language: 'es',
          description: foreignDescriptions.es,
        }}
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

    expect(screen.getByText(foreignDescriptions.es)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Voir la traduction' })
    ).toBeInTheDocument()
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

    render(
      <BookDescriptionSection
        book={{
          googleBooksId: 'volume-1',
          source: 'google-books',
          language: 'en',
          description:
            'This English description has enough words to be clearly eligible for translation in the book page.',
        }}
      />
    )

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
