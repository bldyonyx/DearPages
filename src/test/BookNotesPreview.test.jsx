import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import BookNotesPreview from '../preview/BookNotesPreview.jsx'
import i18n from '../i18n/index.js'
vi.mock('../services/firebase.js', () => { throw new Error('Preview must not import Firebase') })
it('pins and unpins several preview notes without Firebase, including an untitled collapsed note', async () => {
  await i18n.changeLanguage('fr')
  render(<BookNotesPreview />)
  const untitled = screen.getByRole('article', { name: 'Note sans titre' })
  fireEvent.click(within(untitled).getByRole('button', { name: 'Épingler la note' }))
  expect(screen.getAllByRole('article')[0]).toBe(untitled)
  expect(untitled.querySelector('[aria-expanded]')).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Épingler la note' }))
  expect(screen.getAllByRole('button', { name: 'Désépingler la note' })).toHaveLength(2)
  fireEvent.click(within(untitled).getByRole('button', { name: 'Désépingler la note' }))
  expect(screen.getAllByRole('article')[1]).toBe(untitled)
})
