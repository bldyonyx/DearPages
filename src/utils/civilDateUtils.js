export function daysInMonth(year, month) {
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

export function isCivilDate(value) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)
}

export function civilParts(value) {
  const [year, month, day] = value.split('-').map(Number)
  return { year, month, day }
}

export function civilKey({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function todayCivilDate() {
  const now = new Date()
  return civilKey({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() })
}

// UTC is used only for calendar arithmetic/formatting, never for storing a timestamp.
// setUTCFullYear preserves years 0001–0099, unlike the multi-argument Date constructor.
export function civilUtcDate(value) {
  const { year, month, day } = civilParts(value)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(12, 0, 0, 0)
  return date
}

export function formatCivilDate(value, locale, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(civilUtcDate(value))
}

export function shiftCivilDays(value, amount) {
  const date = civilUtcDate(value)
  date.setUTCDate(date.getUTCDate() + amount)
  if (date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) return value
  return civilKey({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() })
}

export function shiftCivilMonths(value, amount) {
  const parts = civilParts(value)
  const index = (parts.year - 1) * 12 + parts.month - 1 + amount
  if (index < 0 || index >= 9999 * 12) return value
  const year = Math.floor(index / 12) + 1
  const month = index % 12 + 1
  return civilKey({ year, month, day: Math.min(parts.day, daysInMonth(year, month)) })
}
