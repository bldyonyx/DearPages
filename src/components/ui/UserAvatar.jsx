import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import flower from '../../assets/images/flower.png'

function getDisplayName(user, fallbackName) {
  return user?.displayName?.trim() || user?.email || fallbackName
}

function getAvatarInitial(displayName) {
  return displayName.trim().charAt(0).toUpperCase() || '?'
}

function UserAvatar({
  user,
  className = '',
  avatarClassName = '',
  initialClassName = '',
}) {
  const { t } = useTranslation()
  const displayName = getDisplayName(
    user,
    t('common.fallbackReader')
  )
  const avatarInitial = getAvatarInitial(displayName)
  const photoURL = user?.photoURL?.trim() || ''
  const [failedPhotoURL, setFailedPhotoURL] = useState('')

  useEffect(() => {
    if (failedPhotoURL && failedPhotoURL !== photoURL) {
      setFailedPhotoURL('')
    }
  }, [failedPhotoURL, photoURL])

  const showPhoto =
    Boolean(photoURL) && failedPhotoURL !== photoURL

  return (
    <div
      className={`
        relative flex shrink-0 items-center justify-center
        ${className}
      `}
    >
      <img
        src={flower}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-contain"
      />

      {showPhoto ? (
        <img
          src={photoURL}
          alt={t('common.profilePhoto', {
            name: displayName,
          })}
          referrerPolicy="no-referrer"
          onError={() => setFailedPhotoURL(photoURL)}
          className={`
            relative z-10 rounded-full object-cover
            ${avatarClassName}
          `}
        />
      ) : (
        <span
          className={`
            relative z-10 flex items-center justify-center
            font-avatar font-normal leading-none text-darkwood
            ${initialClassName}
          `}
        >
          {avatarInitial}
        </span>
      )}
    </div>
  )
}

export default UserAvatar
