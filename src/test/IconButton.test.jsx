import { act, fireEvent, render, screen } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { Pencil } from 'lucide-react'
import IconButton from '../components/ui/IconButton.jsx'

it('provides a permanent name and a focus/hover tooltip that Escape dismisses', () => {
  const click=vi.fn()
  render(<IconButton label="Modifier l’évaluation" onClick={click}><Pencil aria-hidden="true" /></IconButton>)
  const button=screen.getByRole('button',{name:'Modifier l’évaluation'})
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  act(()=>button.focus())
  const tooltip=screen.getByRole('tooltip')
  expect(button).toHaveAccessibleDescription('Modifier l’évaluation')
  expect(button).toHaveAttribute('aria-describedby',tooltip.id)
  fireEvent.mouseEnter(button.parentElement);fireEvent.mouseLeave(button.parentElement)
  expect(screen.getByRole('tooltip')).toBeInTheDocument() // Focus keeps the tooltip open.
  fireEvent.keyDown(button,{key:'Escape'})
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  expect(button).toHaveFocus()
  fireEvent.click(button);expect(click).toHaveBeenCalledTimes(1)
})
it('exposes a helpful description on hover and disables writes without hiding the action', () => {
  const click=vi.fn()
  render(<IconButton label="Actualiser les notes" hint="Récupérer les changements" disabled onClick={click}><Pencil aria-hidden="true" /></IconButton>)
  const button=screen.getByRole('button',{name:'Actualiser les notes'})
  expect(button).toBeDisabled()
  fireEvent.mouseEnter(button.parentElement)
  expect(screen.getByRole('tooltip')).toHaveTextContent('Récupérer les changements')
  fireEvent.click(button);expect(click).not.toHaveBeenCalled()
})
