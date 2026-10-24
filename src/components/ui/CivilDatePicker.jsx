import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import Button from './Button.jsx'
import Input from './Input.jsx'
import Select from './Select.jsx'
import Portal from './Portal.jsx'
import { civilKey, civilParts, civilUtcDate, daysInMonth, formatCivilDate, isCivilDate, shiftCivilDays, shiftCivilMonths, todayCivilDate } from '../../utils/civilDateUtils.js'

function Calendar({ value, initial, onSelect, onClose, anchorRef, label, dialogId }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.resolvedLanguage || 'fr'
  const id = useId()
  const panelRef = useRef(null)
  const focusGrid = useRef(true)
  const [focused, setFocused] = useState(initial)
  const [yearText, setYearText] = useState(String(civilParts(initial).year))
  const [position, setPosition] = useState(null)
  const { year, month } = civilParts(focused)
  const monthLabel = formatCivilDate(focused, locale, { month: 'long', year: 'numeric' })
  const start = (civilUtcDate(civilKey({ year, month, day: 1 })).getUTCDay() + 6) % 7
  const cells = Array.from({ length: Math.ceil((start + daysInMonth(year, month)) / 7) * 7 }, (_, index) => {
    const day = index - start + 1
    return day >= 1 && day <= daysInMonth(year, month) ? civilKey({ year, month, day }) : null
  })

  useLayoutEffect(() => {
    function place() {
      const anchor = anchorRef.current?.getBoundingClientRect()
      const panel = panelRef.current
      if (!anchor || !panel) return
      const { width, height } = panel.getBoundingClientRect()
      const below = anchor.bottom + 8
      setPosition({ left: Math.max(12, Math.min(anchor.left, window.innerWidth - width - 12)), top: below + height <= window.innerHeight - 12 ? below : Math.max(12, anchor.top - height - 8) })
    }
    function outside(event) {
      if (!panelRef.current?.contains(event.target) && !anchorRef.current?.contains(event.target)) onClose(false)
    }
    place()
    document.addEventListener('pointerdown', outside)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', outside)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchorRef, onClose, month, year])

  useLayoutEffect(() => {
    if (focusGrid.current) {
      panelRef.current?.querySelector(`[data-date="${focused}"]`)?.focus({ preventScroll: true })
      focusGrid.current = false
    }
  }, [focused])

  function move(next, focus = false) {
    focusGrid.current = focus
    setFocused(next)
    setYearText(String(civilParts(next).year))
  }

  function handleKey(event) {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(true); return }
    if (event.key === 'Tab') {
      const controls = [...panelRef.current.querySelectorAll('button:not(:disabled), select, input')].filter((element) => element.tabIndex >= 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      return
    }
    if (!event.target.dataset.date) return
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(focused); return }
    const weekday = (civilUtcDate(focused).getUTCDay() + 6) % 7
    const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7, Home: -weekday, End: 6 - weekday }
    if (Object.hasOwn(offsets, event.key)) {
      event.preventDefault(); move(shiftCivilDays(focused, offsets[event.key]), true)
    } else if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault(); move(shiftCivilMonths(focused, (event.key === 'PageUp' ? -1 : 1) * (event.shiftKey ? 12 : 1)), true)
    }
  }

  return <Portal>
    <div id={dialogId} ref={panelRef} role="dialog" aria-modal="true" aria-label={label} onKeyDown={handleKey}
      className="dp-menu-enter fixed z-50 w-72 max-w-[calc(100vw-1.5rem)] overflow-y-auto rounded-2xl border border-walnut/15 bg-cream p-3 shadow-lg"
      style={{ ...(position || { left: 12, top: 12 }), maxHeight: 'calc(100vh - 24px)' }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button type="button" variant="secondary" aria-label={t('calendar.previousMonth')} disabled={year === 1 && month === 1} onClick={() => move(shiftCivilMonths(focused, -1))} className="px-2"><ChevronLeft size={16} aria-hidden="true" /></Button>
        <p aria-live="polite" className="font-heading text-lg font-bold text-darkwood">{monthLabel}</p>
        <Button type="button" variant="secondary" aria-label={t('calendar.nextMonth')} disabled={year === 9999 && month === 12} onClick={() => move(shiftCivilMonths(focused, 1))} className="px-2"><ChevronRight size={16} aria-hidden="true" /></Button>
      </div>
      <div className="mb-3 grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <Select id={`${id}-month`} aria-label={t('calendar.month')} value={month} onChange={(event) => move(shiftCivilMonths(focused, Number(event.target.value) - month))} className="min-w-0 w-full px-2">
          {Array.from({ length: 12 }, (_, index) => <option key={index} value={index + 1}>{t(`months.${index}`)}</option>)}
        </Select>
        <Input id={`${id}-year`} type="number" aria-label={t('calendar.year')} min={1} max={9999} value={yearText}
          aria-invalid={!/^[0-9]{1,4}$/.test(yearText) || Number(yearText) < 1 || Number(yearText) > 9999}
          onChange={(event) => {
            const text = event.target.value; setYearText(text)
            if (/^[0-9]{1,4}$/.test(text) && Number(text) >= 1 && Number(text) <= 9999) {
              focusGrid.current = false; setFocused(shiftCivilMonths(focused, (Number(text) - year) * 12))
            }
          }} onBlur={() => setYearText(String(year))} className="min-w-0 w-full px-2" />
      </div>
      <table role="grid" aria-label={monthLabel} className="w-full table-fixed border-separate border-spacing-0.5 font-ui text-xs text-darkwood">
        <thead><tr>{Array.from({ length: 7 }, (_, index) => <th key={index} scope="col" className="pb-2 font-normal text-walnut/65" aria-label={formatCivilDate(`2024-01-0${index + 1}`, locale, { weekday: 'long' })}>{formatCivilDate(`2024-01-0${index + 1}`, locale, { weekday: 'short' })}</th>)}</tr></thead>
        <tbody>{Array.from({ length: cells.length / 7 }, (_, row) => <tr key={row}>
          {cells.slice(row * 7, row * 7 + 7).map((date, index) => <td key={date || `empty-${index}`} role="gridcell" aria-selected={date ? date === value : undefined}>
            {date && <button type="button" data-date={date} tabIndex={date === focused ? 0 : -1} aria-label={formatCivilDate(date, locale)} aria-current={date === todayCivilDate() ? 'date' : undefined}
              onFocus={() => { if (date !== focused) { focusGrid.current = false; setFocused(date) } }}
              onClick={() => onSelect(date)}
              className={`flex size-8 items-center justify-center rounded-lg transition-colors duration-200 ease-out hover:bg-mintcream active:bg-lime/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-olive/35 ${date === value ? 'bg-lime font-bold' : ''}`}>{civilParts(date).day}</button>}
          </td>)}
        </tr>)}</tbody>
      </table>
      <p className="mt-3 font-ui text-xs leading-5 text-walnut/65">{t('calendar.keyboardHint')}</p>
      <div className="mt-2 flex justify-end"><Button type="button" variant="secondary" onClick={() => onClose(true)}>{t('common.close')}</Button></div>
    </div>
  </Portal>
}

export default function CivilDatePicker({ id, label, value, onChange, disabled = false }) {
  const { t, i18n } = useTranslation()
  const triggerRef = useRef(null)
  const dialogId = useId()
  const [open, setOpen] = useState(false)
  function close(restore) { setOpen(false); if (restore) triggerRef.current?.focus() }
  return <div className="min-w-0 space-y-2">
    <label htmlFor={id} className="block font-ui text-sm text-darkwood">{label}</label>
    <Button id={id} ref={triggerRef} type="button" variant="secondary" disabled={disabled} aria-haspopup="dialog" aria-controls={open && !disabled ? dialogId : undefined} aria-expanded={open && !disabled}
      onClick={() => setOpen((current) => !current)} className="inline-flex w-full items-center justify-between gap-2 rounded-xl py-2.5 text-left">
      <span>{isCivilDate(value) ? formatCivilDate(value, i18n.resolvedLanguage || 'fr') : t('calendar.chooseDate')}</span><CalendarDays size={17} aria-hidden="true" className="shrink-0 text-olive" />
    </Button>
    {open && !disabled && <Calendar value={value} initial={isCivilDate(value) ? value : todayCivilDate()} label={label} dialogId={dialogId} anchorRef={triggerRef}
      onClose={close} onSelect={(date) => { onChange(date); close(true) }} />}
  </div>
}
