import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import BookDescriptionSection from '../components/books/BookDescriptionSection.jsx'
import { translateText } from '../services/translationService.js'

vi.mock('../services/translationService.js', () => ({
  translateText: vi.fn(),
}))

afterEach(() => {
  vi.clearAllMocks()
})

describe('BookDescriptionSection translation error', () => {
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
