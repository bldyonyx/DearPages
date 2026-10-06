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

describe('BookDescriptionSection translation diagnostics', () => {
  it('shows temporary sanitized diagnostics below the friendly error', async () => {
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

    const diagnostic = screen.getByText(
      /Diag temporaire : status=403;/
    )

    expect(diagnostic).toHaveTextContent(
      'reason=forbidden; message=API key restriction blocked this origin.; origin=https://dear-pages-booktracker.web.app; hasApiKey=true; hasHttpResponse=true'
    )
    expect(diagnostic).not.toHaveTextContent('volume-1')
    expect(diagnostic).not.toHaveTextContent('enough words')

  })
})
