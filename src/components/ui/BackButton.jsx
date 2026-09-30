import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

function BackButton({
  to,
  onClick,
  children = 'Retour',
  className = '',
}) {
  const navigate = useNavigate()

  const classes = `
    group inline-flex
    items-center gap-2
    rounded-full
    border border-walnut/10
    bg-cream/75
    px-3.5 py-2
    font-ui text-sm
    text-walnut
    shadow-sm
    transition
    duration-200
    hover:-translate-y-0.5
    hover:border-walnut/20
    hover:bg-cream
    hover:text-darkwood
    hover:shadow-md
    focus:outline-none
    focus-visible:ring-2
    focus-visible:ring-darkwood/25
    ${className}
  `

  const content = (
    <>
      <ArrowLeft
        aria-hidden="true"
        size={16}
        strokeWidth={1.8}
        className="
          transition-transform
          duration-200
          group-hover:-translate-x-1
        "
      />

      <span>{children}</span>
    </>
  )

  if (to) {
    return (
      <Link to={to} className={classes}>
        {content}
      </Link>
    )
  }

  function handleClick() {
    if (onClick) {
      onClick()
      return
    }

    navigate(-1)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={classes}
    >
      {content}
    </button>
  )
}

export default BackButton