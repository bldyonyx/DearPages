import flower from '../../assets/images/flower.png'

function getDisplayName(user) {
  return user?.displayName?.trim() || user?.email || 'lectrice'
}

function getAvatarInitial(displayName) {
  return displayName.trim().charAt(0).toUpperCase() || '?'
}

function ProfileCard({ user }) {
  const displayName = getDisplayName(user)
  const avatarInitial = getAvatarInitial(displayName)

  return (
    <section
      className="
        rounded-3xl border border-walnut/15
        bg-cream/90 p-5 shadow-sm
        sm:p-6
      "
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div
          className="
            relative flex h-20 w-20 shrink-0
            items-center justify-center
            sm:h-24 sm:w-24
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
              relative z-10 flex h-13 w-13
              items-center justify-center rounded-full
              bg-cream font-heading text-2xl
              font-bold text-darkwood
              sm:h-15 sm:w-15 sm:text-3xl
            "
          >
            {avatarInitial}
          </span>
        </div>

        <div className="min-w-0">
          <p className="font-handwritten text-xl text-walnut sm:text-2xl">
            ton profil
          </p>

          <h2 className="mt-1 break-words font-heading text-3xl font-bold leading-tight text-darkwood">
            {displayName}
          </h2>

          {user?.email && (
            <p className="mt-2 break-words text-sm font-bold text-darkwood/60">
              {user.email}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default ProfileCard
