import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import BookStatusSelect from '../components/books/BookStatusSelect.jsx'

const STATUS_OPTIONS = [
  { value: 'to-read', label: 'A lire' },
  { value: 'reading', label: 'En cours' },
  { value: 'finished', label: 'Termine' },
  { value: 'abandoned', label: 'Abandonne' },
]

describe('floating menus', () => {
  it('renders the book status menu outside its local stacking context', () => {
    const onChange = vi.fn()

    const { container } = render(
      <div data-testid="stacking-context">
        <BookStatusSelect
          value="to-read"
          options={STATUS_OPTIONS}
          onChange={onChange}
        />
      </div>
    )

    fireEvent.click(
      screen.getByRole('button', { name: /a lire/i })
    )

    const option = screen.getByRole('button', {
      name: /en cours/i,
    })
    const floatingMenu = option.closest('.dp-menu-enter')

    expect(floatingMenu).not.toBeNull()
    expect(container).not.toContainElement(floatingMenu)

    fireEvent.click(option)

    expect(onChange).toHaveBeenCalledWith('reading')
  })
})
