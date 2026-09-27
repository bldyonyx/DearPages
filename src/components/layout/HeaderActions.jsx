import { Link } from 'react-router-dom'

import flower from '../../assets/images/flower.png'

function getDisplayName(user) {
  return user?.displayName?.trim() || user?.email || 'lectrice'
}

function getAvatarInitial(displayName) {
  return displayName.trim().charAt(0).toUpperCase() || '?'
}

function HeaderActions({ className = '', user = null }) {
  const avatarInitial = getAvatarInitial(getDisplayName(user))

  return (
    <div
      className={[
        'flex min-w-0 items-center md:flex-1 md:justify-end',
        className,
      ].join(' ')}
    >
      {/* Profil */}
      <Link
        to="/settings"
        aria-label="Ouvrir les paramètres du profil"
        className="
          relative flex h-14 w-14 shrink-0 cursor-pointer
          items-center justify-center
          transition-transform
          hover:-translate-y-0.5
          md:h-16 md:w-16
        "
      >
        <img
          src={flower}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full object-contain"
        />

        <span
          className="
            relative z-10 flex h-9 w-9
            items-center justify-center
            rounded-full bg-cream
            font-heading text-base font-bold text-darkwood
            md:h-10 md:w-10 md:text-lg
          "
        >
          {avatarInitial}
        </span>
      </Link>
    </div>
  )
}

export default HeaderActions