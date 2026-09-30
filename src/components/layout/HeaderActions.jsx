import { Link } from 'react-router-dom'

import UserAvatar from '../ui/UserAvatar.jsx'

function HeaderActions({ className = '', user = null }) {
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
          shrink-0 cursor-pointer
          rounded-full
          transition-transform duration-200 ease-out
          hover:-translate-y-0.5
          focus-visible:outline-none
          focus-visible:ring-2
          focus-visible:ring-lime/45
        "
      >
        <UserAvatar
          user={user}
          className="h-14 w-14 md:h-16 md:w-16"
          avatarClassName="h-9 w-9 md:h-10 md:w-10"
          initialClassName="
            h-9 w-9 text-2xl
            md:h-10 md:w-10 md:text-3xl
          "
        />
      </Link>
    </div>
  )
}

export default HeaderActions
