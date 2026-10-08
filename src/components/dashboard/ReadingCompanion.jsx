import { useTranslation } from 'react-i18next'

import sleepingCat from '../../assets/images/cats/sleeping-cat.png'
import noteArea from '../../assets/images/note-area.png'

function ReadingCompanion() {
  const { t } = useTranslation()

  return (
    <section
      className={`
        flex w-full
        flex-col items-center justify-center
        gap-5
        sm:flex-row
        min-[1380px]:w-auto
        min-[1380px]:flex-none
        min-[1380px]:gap-6
        [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-8
        [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-10
      `}
    >
      {/* Chat */}
      <div
        className="
          flex shrink-0
          items-center justify-center
        "
      >
        <img
          src={sleepingCat}
          alt={t('dashboard.companion.imageAlt')}
          className={`
            h-auto
            w-64
            shrink-0
            object-contain
            lg:w-72
            min-[1380px]:w-64
            min-[1750px]:w-72
            [@media_(min-width:2200px)_and_(min-height:1100px)]:w-80
            [@media_(min-width:2400px)_and_(min-height:1300px)]:w-96
          `}
        />
      </div>

      {/* Petite note */}
      <div
        className={`
          relative
          w-64
          shrink-0
          min-[1750px]:w-72
          [@media_(min-width:2200px)_and_(min-height:1100px)]:w-80
          [@media_(min-width:2400px)_and_(min-height:1300px)]:w-96
        `}
      >
        <img
          src={noteArea}
          alt=""
          aria-hidden="true"
          className="
            h-auto
            w-full
            object-contain
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            inset-0
            flex
            items-center
            justify-center
            px-[15%]
            pt-[8%]
            text-center
          "
        >
          <p
            className="
              font-handwritten
              text-lg
              leading-[1.3]
              text-darkwood
              min-[1750px]:text-xl
              [@media_(min-width:2200px)_and_(min-height:1100px)]:text-2xl
              [@media_(min-width:2400px)_and_(min-height:1300px)]:text-3xl
            "
          >
            {t('dashboard.companion.note')
              .split('\n')
              .map((line, index, lines) => (
                <span key={`${line}-${index}`}>
                  {line}
                  {index < lines.length - 1 && <br />}
                </span>
              ))}
          </p>
        </div>
      </div>
    </section>
  )
}

export default ReadingCompanion
