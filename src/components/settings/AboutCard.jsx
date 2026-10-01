import {
  BookOpenText,
  Code2,
  ExternalLink,
} from 'lucide-react'
import { settingsLarge } from './settingsResponsive.js'

function AboutCard() {
  return (
    <section
      className={`
        rounded-3xl border border-darkwood/10 bg-cream/80 p-6 shadow-sm sm:p-8
        ${settingsLarge.card}
      `}
    >
      <div className="mb-6">

        <h2
          className={`
            mt-1 font-heading text-2xl font-bold text-darkwood
            ${settingsLarge.cardTitle}
          `}
        >
          À propos de Dear Pages
        </h2>

        <p
          className={`
            mt-2 max-w-2xl font-ui text-sm leading-relaxed text-darkwood/60
            ${settingsLarge.description}
          `}
        >
          Retrouve la documentation du projet et son code source.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <a
          href="https://dear-pages-docs.web.app"
          target="_blank"
          rel="noreferrer"
          className="
            group flex items-center justify-between gap-4
            rounded-2xl border border-darkwood/10
            bg-mintcream/60 px-5 py-4
            transition
            hover:-translate-y-0.5 hover:border-olive/30
            hover:bg-mintcream
            [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
            [@media_(min-width:2200px)_and_(min-height:1100px)]:py-5
          "
        >
          <span className="flex min-w-0 items-center gap-3">
            <BookOpenText
              className="shrink-0 text-forest"
              size={20}
              strokeWidth={1.8}
            />

            <span>
              <span
                className={`
                  block font-ui text-sm font-bold text-darkwood
                  ${settingsLarge.description}
                `}
              >
                Documentation
              </span>

              <span
                className={`
                  mt-0.5 block font-ui text-xs text-darkwood/50
                  ${settingsLarge.smallText}
                `}
              >
                Astro · Starlight
              </span>
            </span>
          </span>

          <ExternalLink
            className="
              shrink-0 text-walnut/50 transition
              group-hover:text-forest
            "
            size={17}
          />
        </a>

        <a
          href="https://github.com/bldyonyx/DearPages"
          target="_blank"
          rel="noreferrer"
          className="
            group flex items-center justify-between gap-4
            rounded-2xl border border-darkwood/10
            bg-mintcream/60 px-5 py-4
            transition
            hover:-translate-y-0.5 hover:border-olive/30
            hover:bg-mintcream
            [@media_(min-width:2200px)_and_(min-height:1100px)]:px-6
            [@media_(min-width:2200px)_and_(min-height:1100px)]:py-5
          "
        >
          <span className="flex min-w-0 items-center gap-3">
            <Code2
              className="shrink-0 text-forest"
              size={20}
              strokeWidth={1.8}
            />

            <span>
              <span
                className={`
                  block font-ui text-sm font-bold text-darkwood
                  ${settingsLarge.description}
                `}
              >
                GitHub
              </span>

              <span
                className={`
                  mt-0.5 block font-ui text-xs text-darkwood/50
                  ${settingsLarge.smallText}
                `}
              >
                Code source du projet
              </span>
            </span>
          </span>

          <ExternalLink
            className="
              shrink-0 text-walnut/50 transition
              group-hover:text-forest
            "
            size={17}
          />
        </a>
      </div>

      <p
        className={`
          mt-6 text-right font-handwritten text-base text-walnut/60
          ${settingsLarge.handwritten}
        `}
      >
        Dear Pages · 2026 ♡
      </p>
    </section>
  )
}

export default AboutCard
