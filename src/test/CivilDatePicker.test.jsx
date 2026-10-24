import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '../i18n/index.js'
import CivilDatePicker from '../components/ui/CivilDatePicker.jsx'
import { civilUtcDate, formatCivilDate, isCivilDate, shiftCivilDays, shiftCivilMonths } from '../utils/civilDateUtils.js'

beforeEach(async () => { await i18n.changeLanguage('fr') })
function setup(value = '2024-02-29', disabled = false) {
  const changed = vi.fn()
  function Harness() {
    const [date, setDate] = useState(value)
    return <><CivilDatePicker id="note-date" label="Date" value={date} disabled={disabled} onChange={(next) => { setDate(next); changed(next) }} /><button type="button">Extérieur</button><output data-testid="value">{date}</output></>
  }
  render(<Harness />)
  const trigger = screen.getByRole('button', { name: 'Date' })
  fireEvent.click(trigger)
  return { changed, trigger }
}

describe('civil calendar', () => {
  it('opens on the selected day, supports arrows across months and commits with Enter', () => {
    const { changed, trigger } = setup()
    expect(screen.getByRole('dialog', { name: 'Date' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '29 février 2024' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement, { key: 'ArrowRight' })
    expect(screen.getByRole('button', { name: '1 mars 2024' })).toHaveFocus()
    expect(changed).not.toHaveBeenCalled()
    fireEvent.keyDown(document.activeElement, { key: 'Enter' })
    expect(changed).toHaveBeenCalledExactlyOnceWith('2024-03-01')
    expect(screen.getByTestId('value')).toHaveTextContent('2024-03-01')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('supports month/year navigation, leap years and historical years without a recent-year ceiling', () => {
    const { changed } = setup()
    const dialog = screen.getByRole('dialog')
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Année' }), { target: { value: '1900' } })
    expect(within(dialog).queryByRole('button', { name: '29 février 1900' })).not.toBeInTheDocument()
    fireEvent.change(within(dialog).getByRole('spinbutton', { name: 'Année' }), { target: { value: '1' } })
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Mois' }), { target: { value: '1' } })
    expect(within(dialog).getByRole('button', { name: 'Mois précédent' })).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('button', { name: '1 janvier 1' }))
    expect(changed).toHaveBeenCalledWith('0001-01-01')
  })

  it('supports week keys, Page Up/Down with Shift for years, and Space selection', () => {
    const { changed } = setup('2024-03-13')
    fireEvent.keyDown(document.activeElement, { key: 'Home' })
    expect(screen.getByRole('button', { name: '11 mars 2024' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement, { key: 'End' })
    expect(screen.getByRole('button', { name: '17 mars 2024' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement, { key: 'ArrowUp' })
    expect(screen.getByRole('button', { name: '10 mars 2024' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement, { key: 'PageUp' })
    expect(screen.getByRole('button', { name: '10 février 2024' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement, { key: 'PageDown', shiftKey: true })
    expect(screen.getByRole('button', { name: '10 février 2025' })).toHaveFocus()
    fireEvent.keyDown(document.activeElement, { key: ' ' })
    expect(changed).toHaveBeenCalledWith('2025-02-10')
  })

  it('navigates with month buttons and preserves the value until a day is selected', () => {
    const { changed } = setup('2024-01-31')
    fireEvent.click(screen.getByRole('button', { name: 'Mois suivant' }))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'février 2024')
    fireEvent.click(screen.getByRole('button', { name: 'Mois précédent' }))
    expect(screen.getByRole('grid')).toHaveAttribute('aria-label', 'janvier 2024')
    expect(changed).not.toHaveBeenCalled()
  })

  it('closes with Escape and restores focus without changing the date', () => {
    const { trigger, changed } = setup()
    fireEvent.keyDown(document.activeElement, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
    expect(changed).not.toHaveBeenCalled()
  })

  it('closes on an outside pointer action and cycles Tab inside the dialog', () => {
    const { changed } = setup()
    const first = screen.getByRole('button', { name: 'Mois précédent' })
    const last = screen.getByRole('button', { name: 'Fermer' })
    last.focus(); fireEvent.keyDown(last, { key: 'Tab' }); expect(first).toHaveFocus()
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true }); expect(last).toHaveFocus()
    const outside = screen.getByRole('button', { name: 'Extérieur' })
    fireEvent.pointerDown(outside); outside.focus()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(outside).toHaveFocus()
    expect(changed).not.toHaveBeenCalled()
  })

  it('rejects invalid years, permits 9999 and disables overflow navigation', () => {
    setup('9999-12-31')
    expect(screen.getByRole('button', { name: 'Mois suivant' })).toBeDisabled()
    const year = screen.getByRole('spinbutton', { name: 'Année' })
    fireEvent.change(year, { target: { value: '0' } })
    expect(year).toHaveAttribute('aria-invalid', 'true')
    fireEvent.blur(year)
    expect(year).toHaveValue(9999)
    fireEvent.keyDown(screen.getByRole('button', { name: '31 décembre 9999' }), { key: 'ArrowRight' })
    expect(screen.getByTestId('value')).toHaveTextContent('9999-12-31')
  })

  it('does not open when disabled and localizes the calendar in English', async () => {
    setup('2024-02-29', true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    await i18n.changeLanguage('en')
    expect(screen.getByRole('button', { name: 'Date' })).toHaveTextContent('February 29, 2024')
  })
})

describe('civil date arithmetic', () => {
  it.each(['0001-01-01', '0099-12-31', '1900-02-28', '2000-02-29', '2024-03-31', '9999-12-31'])('preserves %s without interpreting a local timezone', (date) => {
    expect(isCivilDate(date)).toBe(true)
    expect(civilUtcDate(date).toISOString().slice(0, 10)).toBe(date)
    expect(formatCivilDate(date, 'en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' })).toBeTruthy()
  })
  it('clamps month-end and year boundaries without producing invalid civil dates', () => {
    expect(shiftCivilMonths('2024-01-31', 1)).toBe('2024-02-29')
    expect(shiftCivilMonths('2024-02-29', 12)).toBe('2025-02-28')
    expect(shiftCivilDays('0001-01-01', -1)).toBe('0001-01-01')
    expect(shiftCivilDays('9999-12-31', 1)).toBe('9999-12-31')
    expect(isCivilDate('1900-02-29')).toBe(false)
  })
})
