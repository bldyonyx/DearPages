import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import BookFinalStatusDate from '../components/books/BookFinalStatusDate.jsx'
import i18n from '../i18n/index.js'
beforeEach(async()=>{await i18n.changeLanguage('fr')})
it('shows an unknown date in a secondary line, with an accessible pencil and the existing month/year editor',async()=>{
  const save=vi.fn()
  render(<BookFinalStatusDate title="Lecture terminée" value={null} onSave={save} />)
  expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  expect(screen.getByText('Date inconnue')).toBeInTheDocument()
  const edit=screen.getByRole('button',{name:'Ajouter la date · Lecture terminée'})
  expect(edit).toHaveAttribute('aria-expanded','false')
  fireEvent.click(edit)
  expect(edit).toHaveAttribute('aria-expanded','true')
  expect(edit).toBeDisabled()
  fireEvent.click(screen.getByRole('button',{name:'Je ne sais plus'}))
  await waitFor(()=>expect(save).toHaveBeenCalledWith(null))
  expect(save).toHaveBeenCalledTimes(1)
})
it('cancels edits without writing and preserves the recorded reading date',()=>{
  const save=vi.fn()
  render(<BookFinalStatusDate title="Lecture abandonnée" value={new Date(2026,2,1,12).getTime()} onSave={save} />)
  expect(screen.getByText('Mars 2026').closest('time')).toHaveAttribute('datetime','2026-03')
  fireEvent.click(screen.getByRole('button',{name:'Modifier la date · Lecture abandonnée'}))
  fireEvent.click(screen.getByRole('button',{name:'Annuler'}))
  expect(screen.getByText('Mars 2026')).toBeInTheDocument()
  expect(save).not.toHaveBeenCalled()
})
