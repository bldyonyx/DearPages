import { useId, useState } from 'react'
import Button from './Button.jsx'

// Always visible, touch-sized action. The tooltip is available on hover and focus,
// dismissible with Escape; the accessible name does not depend on the tooltip.
export default function IconButton({ label, hint = label, children, ...props }) {
  const id = useId()
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const open = !dismissed && (hovered || focused)
  return <span className="relative inline-flex shrink-0" onMouseEnter={() => { setHovered(true); setDismissed(false) }} onMouseLeave={() => setHovered(false)}
    onFocus={() => { setFocused(true); setDismissed(false) }} onBlur={() => setFocused(false)} onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setDismissed(true) }
    }}>
    <Button type="button" variant="ghost" size="icon" aria-label={label} aria-describedby={open ? id : undefined} {...props}>{children}</Button>
    {open && <span id={id} role="tooltip" className="absolute bottom-full right-0 z-50 w-max max-w-52 rounded-lg bg-darkwood px-2 py-1 font-ui text-xs leading-5 text-cream shadow-sm">{hint}</span>}
  </span>
}
