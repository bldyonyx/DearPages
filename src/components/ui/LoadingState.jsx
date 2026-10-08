import { BookOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const authBackground = {
  backgroundImage: `
    linear-gradient(
      90deg,
      rgba(144, 153, 119, 0.08) 50%,
      transparent 50%
    ),
    linear-gradient(
      rgba(144, 153, 119, 0.08) 50%,
      transparent 50%
    )
  `,
  backgroundSize: '90px 90px',
}

function LoadingState({
  message,
  fullscreen = false,
}) {
  const { t } = useTranslation()
  const loadingMessage = message ?? t('common.loading')

  const content = (
    <div
      role="status"
      aria-live="polite"
      className="
        flex flex-col items-center justify-center
        py-10 text-center
      "
    >
      <div
        aria-hidden="true"
        className="
          relative mb-5 flex h-18 w-18
          items-center justify-center
        "
      >
        <div
          className="
            absolute inset-0
            animate-pulse rounded-full
            bg-lime/30
          "
        />

        <div
          className="
            absolute inset-2 rounded-full
            border border-olive/15
            bg-cream/90 shadow-sm
          "
        />

        <BookOpen
          size={27}
          strokeWidth={1.5}
          className="relative z-10 text-darkwood"
        />
      </div>

      <p
        className="
          font-heading text-2xl font-semibold
          tracking-wide text-darkwood
        "
      >
          {t('common.appName')}
      </p>

      {fullscreen ? (
        <p
          className="
            mt-2 font-handwritten
            text-xl text-walnut
          "
        >
          {t('loading.fullscreenMessage')}
        </p>
      ) : (
        <p className="mt-2 font-ui text-sm text-darkwood/55">
          {loadingMessage}
        </p>
      )}

      <div
        aria-hidden="true"
        className="
          mt-5 flex items-center gap-2
          text-walnut/45
        "
      >
        <span
          className="
            h-1.5 w-1.5 animate-pulse
            rounded-full bg-current
          "
        />

        <span
          className="
            h-1.5 w-1.5 animate-pulse
            rounded-full bg-current
            [animation-delay:150ms]
          "
        />

        <span
          className="
            h-1.5 w-1.5 animate-pulse
            rounded-full bg-current
            [animation-delay:300ms]
          "
        />
      </div>

      <span className="sr-only">{loadingMessage}</span>
    </div>
  )

  if (!fullscreen) {
    return content
  }

  return (
    <main
      className="
        flex min-h-screen items-center justify-center
        bg-mintcream px-6
        font-ui text-ink
      "
      style={authBackground}
    >
      {content}
    </main>
  )
}

export default LoadingState
