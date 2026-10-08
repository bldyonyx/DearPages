import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  CalendarDays,
  Check,
  ChevronDown,
  Pencil,
  X,
} from 'lucide-react'

import {
  createReadingTimestamp,
  getReadingMonthYear,
} from '../../utils/readingDateUtils.js'

function BookFinalStatusDate({
  title,
  value,
  disabled = false,
  isSaving = false,
  onSave,
}) {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()
  const monthLabels = Array.from(
    { length: 12 },
    (_, index) => t(`months.${index}`)
  )

  const initialDate = getReadingMonthYear(value)

  const [isEditing, setIsEditing] = useState(false)
  const [openDropdown, setOpenDropdown] = useState(null)

  const [month, setMonth] = useState(
    initialDate?.month ?? new Date().getMonth()
  )

  const [year, setYear] = useState(
    initialDate?.year ?? currentYear
  )

  const editorRef = useRef(null)

  useEffect(() => {
    const nextDate = getReadingMonthYear(value)

    setMonth(
      nextDate?.month ?? new Date().getMonth()
    )

    setYear(
      nextDate?.year ?? currentYear
    )
  }, [value, currentYear])

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        editorRef.current &&
        !editorRef.current.contains(event.target)
      ) {
        setOpenDropdown(null)
      }
    }

    document.addEventListener(
      'mousedown',
      handleOutsideClick
    )

    return () => {
      document.removeEventListener(
        'mousedown',
        handleOutsideClick
      )
    }
  }, [])

  const currentDate = getReadingMonthYear(value)
  const isDisabled = disabled || isSaving

  const years = Array.from(
    { length: currentYear - 1999 },
    (_, index) => currentYear - index
  )

  function handleCancel() {
    const savedDate = getReadingMonthYear(value)

    setMonth(
      savedDate?.month ?? new Date().getMonth()
    )

    setYear(
      savedDate?.year ?? currentYear
    )

    setOpenDropdown(null)
    setIsEditing(false)
  }

  async function handleSave() {
    const timestamp = createReadingTimestamp(
      month,
      year
    )

    await onSave(timestamp)

    setOpenDropdown(null)
    setIsEditing(false)
  }

  async function handleUnknown() {
    await onSave(null)

    setOpenDropdown(null)
    setIsEditing(false)
  }

  function handleMonthSelect(monthIndex) {
    setMonth(monthIndex)
    setOpenDropdown(null)
  }

  function handleYearSelect(yearOption) {
    setYear(yearOption)
    setOpenDropdown(null)
  }

  const dropdownScrollbar = `
    [scrollbar-width:thin]
    [scrollbar-color:rgba(83,55,76,0.22)_transparent]
    [&::-webkit-scrollbar]:w-1.5
    [&::-webkit-scrollbar-track]:bg-transparent
    [&::-webkit-scrollbar-thumb]:rounded-full
    [&::-webkit-scrollbar-thumb]:bg-walnut/20
    [&::-webkit-scrollbar-thumb:hover]:bg-walnut/30
  `

  return (
    <div className="mt-8">
      <h3 className="font-heading text-2xl font-bold text-darkwood">
        {title}
      </h3>

      {!isEditing ? (
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          disabled={isDisabled}
          className="
            mt-3 inline-flex
            items-center gap-2
            rounded-xl
            border border-walnut/15
            bg-mintcream/45
            px-4 py-2.5
            font-ui text-sm
            font-medium text-darkwood
            transition-[border-color,background-color] duration-200 ease-out
            hover:border-olive/30
            hover:bg-mintcream/70
            disabled:cursor-not-allowed
            disabled:opacity-60
          "
        >
          <CalendarDays
            size={17}
            strokeWidth={1.7}
            className="text-olive"
            aria-hidden="true"
          />

          <span>
            {currentDate
              ? `${monthLabels[currentDate.month]} ${currentDate.year}`
              : t('bookPage.date.unknown')}
          </span>

          <Pencil
            size={14}
            strokeWidth={1.7}
            className="ml-1 text-walnut/55"
            aria-hidden="true"
          />
        </button>
      ) : (
        <div
          ref={editorRef}
          aria-busy={isSaving}
          className="
            mt-3
            rounded-2xl
            border border-walnut/10
            bg-mintcream/35
            p-4
          "
        >
          <div
            className="
              flex flex-wrap
              items-start gap-3
            "
          >
            {/* Month */}
            <div className="relative w-full sm:w-44">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown((current) =>
                    current === 'month'
                      ? null
                      : 'month'
                  )
                }
                disabled={isDisabled}
                aria-expanded={
                  openDropdown === 'month'
                }
                className="
                  flex w-full
                  items-center justify-between
                  gap-3
                  rounded-xl
                  border border-walnut/15
                  bg-cream/90
                  px-4 py-2.5
                  font-ui text-sm
                  text-darkwood
                  shadow-[0_2px_8px_rgba(83,55,76,0.03)]
                  transition-[border-color,background-color] duration-200 ease-out
                  hover:border-olive/30
                  hover:bg-cream
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                <span>{monthLabels[month]}</span>

                <ChevronDown
                  size={16}
                  strokeWidth={1.7}
                  aria-hidden="true"
                  className={`
                    shrink-0 text-olive
                    transition-transform duration-200
                    ${
                      openDropdown === 'month'
                        ? 'rotate-180'
                        : ''
                    }
                  `}
                />
              </button>

              {openDropdown === 'month' && (
                <div
                  className={`
                    dp-menu-enter
                    absolute left-0 top-full
                    z-30 mt-2
                    max-h-56
                    w-full
                    overflow-y-auto
                    rounded-2xl
                    border border-walnut/10
                    bg-cream
                    p-1.5
                    shadow-[0_12px_30px_rgba(83,55,76,0.12)]
                    ${dropdownScrollbar}
                  `}
                >
                  {monthLabels.map(
                    (monthLabel, monthIndex) => {
                      const isSelected =
                        month === monthIndex

                      return (
                        <button
                          key={monthLabel}
                          type="button"
                          onClick={() =>
                            handleMonthSelect(
                              monthIndex
                            )
                          }
                          className={`
                            flex w-full
                            items-center
                            justify-between
                            rounded-xl
                            px-3 py-1.5
                            text-left
                            font-ui text-sm
                            transition-colors duration-150
                            ${
                              isSelected
                                ? 'bg-lime/55 font-bold text-darkwood'
                                : 'text-walnut hover:bg-mintcream/70 hover:text-darkwood'
                            }
                          `}
                        >
                          <span>{monthLabel}</span>

                          {isSelected && (
                            <Check
                              size={15}
                              strokeWidth={1.8}
                              className="text-olive"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      )
                    }
                  )}
                </div>
              )}
            </div>

            {/* Year */}
            <div className="relative w-full sm:w-28">
              <button
                type="button"
                onClick={() =>
                  setOpenDropdown((current) =>
                    current === 'year'
                      ? null
                      : 'year'
                  )
                }
                disabled={isDisabled}
                aria-expanded={
                  openDropdown === 'year'
                }
                className="
                  flex w-full
                  items-center justify-between
                  gap-2
                  rounded-xl
                  border border-walnut/15
                  bg-cream/90
                  px-4 py-2.5
                  font-ui text-sm
                  text-darkwood
                  shadow-[0_2px_8px_rgba(83,55,76,0.03)]
                  transition-[border-color,background-color] duration-200 ease-out
                  hover:border-olive/30
                  hover:bg-cream
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                <span>{year}</span>

                <ChevronDown
                  size={16}
                  strokeWidth={1.7}
                  aria-hidden="true"
                  className={`
                    shrink-0 text-olive
                    transition-transform duration-200
                    ${
                      openDropdown === 'year'
                        ? 'rotate-180'
                        : ''
                    }
                  `}
                />
              </button>

              {openDropdown === 'year' && (
                <div
                  className={`
                    dp-menu-enter
                    absolute right-0 top-full
                    z-30 mt-2
                    max-h-56
                    w-full
                    overflow-y-auto
                    rounded-2xl
                    border border-walnut/10
                    bg-cream
                    p-1.5
                    shadow-[0_12px_30px_rgba(83,55,76,0.12)]
                    ${dropdownScrollbar}
                  `}
                >
                  {years.map((yearOption) => {
                    const isSelected =
                      year === yearOption

                    return (
                      <button
                        key={yearOption}
                        type="button"
                        onClick={() =>
                          handleYearSelect(
                            yearOption
                          )
                        }
                        className={`
                          flex w-full
                          items-center
                          justify-between
                          rounded-xl
                          px-3 py-1.5
                          text-left
                          font-ui text-sm
                          transition-colors duration-150
                          ${
                            isSelected
                              ? 'bg-lime/55 font-bold text-darkwood'
                              : 'text-walnut hover:bg-mintcream/70 hover:text-darkwood'
                          }
                        `}
                      >
                        <span>{yearOption}</span>

                        {isSelected && (
                          <Check
                            size={15}
                            strokeWidth={1.8}
                            className="text-olive"
                            aria-hidden="true"
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          <div
            className="
              mt-4 flex flex-wrap
              items-center gap-2
            "
          >
            <button
              type="button"
              onClick={handleSave}
              disabled={isDisabled}
              className="
                inline-flex
                items-center gap-2
                rounded-xl
                border border-olive/15
                bg-lime
                px-4 py-2
                font-ui text-sm
                font-bold text-darkwood
                shadow-[0_3px_10px_rgba(83,55,76,0.05)]
                transition-[transform,filter] duration-200 ease-out
                hover:-translate-y-0.5
                hover:brightness-95
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <Check
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
              />

              {t('common.save')}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isDisabled}
              className="
                inline-flex
                items-center gap-2
                rounded-xl
                px-3 py-2
                font-ui text-sm
                text-walnut
                transition
                hover:bg-walnut/5
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <X
                size={16}
                strokeWidth={1.8}
                aria-hidden="true"
              />

              {t('common.cancel')}
            </button>

            <button
              type="button"
              onClick={handleUnknown}
              disabled={isDisabled}
              className="
                font-ui text-xs
                text-walnut/60
                underline
                decoration-walnut/25
                underline-offset-4
                transition
                hover:text-walnut
                disabled:cursor-not-allowed
                disabled:opacity-60
                sm:ml-auto
              "
            >
              {t('bookPage.date.forgot')}
            </button>
          </div>

          <p
            role="status"
            aria-live="polite"
            className="mt-3 min-h-5 font-ui text-xs text-walnut/60"
          >
            {isSaving ? t('bookPage.date.saving') : ''}
          </p>
        </div>
      )}
    </div>
  )
}

export default BookFinalStatusDate
