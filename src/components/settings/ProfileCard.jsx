import UserAvatar from '../ui/UserAvatar.jsx'
import { settingsLarge } from './settingsResponsive.js'

function getDisplayName(user) {
  return user?.displayName?.trim() || user?.email || 'lectrice'
}

function ProfileCard({ user }) {
  const displayName = getDisplayName(user)

  return (
    <section
      className={`
        rounded-3xl border border-walnut/15
        bg-cream/90 p-5 shadow-sm
        sm:p-6
        ${settingsLarge.card}
      `}
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <UserAvatar
          user={user}
          className="
            h-20 w-20
            sm:h-24 sm:w-24
          "
          avatarClassName="
            h-13 w-13
            sm:h-15 sm:w-15
          "
          initialClassName="
            h-13 w-13 text-2xl
            sm:h-15 sm:w-15 sm:text-3xl
          "
        />

        <div className="min-w-0">
          <p
            className={`
              font-handwritten text-xl text-walnut sm:text-2xl
              ${settingsLarge.handwritten}
            `}
          >
            ton profil
          </p>

          <h2
            className={`
              mt-1 wrap-break-word font-heading text-3xl font-bold
              leading-tight text-darkwood
              ${settingsLarge.cardTitle}
            `}
          >
            {displayName}
          </h2>

          {user?.email && (
            <p
              className={`
                mt-2 wrap-break-word text-sm font-bold text-darkwood/60
                ${settingsLarge.smallText}
              `}
            >
              {user.email}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default ProfileCard