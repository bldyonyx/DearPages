import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import LibraryEmptyState from '../components/library/LibraryEmptyState'

function renderLibraryEmptyState() {
  return render(
    <MemoryRouter>
      <LibraryEmptyState />
    </MemoryRouter>
  )
}

describe('LibraryEmptyState', () => {
  it('displays the empty library message', () => {
    renderLibraryEmptyState()

    expect(
      screen.getByText('Ta bibliothèque est encore vide')
    ).toBeInTheDocument()

    expect(
      screen.getByText(
        'Découvre des livres et ajoute ceux que tu veux garder près de toi.'
      )
    ).toBeInTheDocument()
  })

  it('provides a link to discover books', () => {
    renderLibraryEmptyState()

    const discoverLink = screen.getByRole('link', {
      name: 'Découvrir des livres',
    })

    expect(discoverLink).toBeInTheDocument()
    expect(discoverLink).toHaveAttribute('href', '/discover')
  })
})