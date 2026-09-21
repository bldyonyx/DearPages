import { Link } from 'react-router-dom'

function AuthLayout({
  children,
  title,
  subtitle,
  footerText,
  footerLinkText,
  footerLinkTo,
}) {
  return (
    <main
      className="
        min-h-screen bg-mintcream px-4 py-8
        font-ui text-ink
        md:flex md:items-center md:justify-center md:p-8
      "
      style={{
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
      }}
    >
      <section
        className="
          mx-auto flex min-h-180 w-full max-w-5xl
          overflow-hidden rounded-[28px]
          bg-cream shadow-xl
          md:min-h-190
        "
      >
        <aside
          className="
            relative hidden w-[34%] shrink-0
            flex-col justify-between overflow-hidden
            px-10 py-14 text-cream
            md:flex
          "
          style={{
            backgroundColor: '#453228',
            backgroundImage: `
              repeating-linear-gradient(
                90deg,
                rgba(255, 255, 255, 0.035) 0,
                rgba(255, 255, 255, 0.035) 34px,
                rgba(0, 0, 0, 0.06) 34px,
                rgba(0, 0, 0, 0.06) 68px
              )
            `,
          }}
        >
          <div>
            <Link
              to="/"
              className="
                font-heading text-5xl font-bold
                leading-[0.9] tracking-wide text-cream
              "
            >
              Dear
              <br />
              Pages ♡
            </Link>

            <p
              className="
                mt-8 max-w-48 font-handwritten
                text-xl leading-relaxed text-parchment
              "
            >
              choisis tes histoires
              <br />
              suis ton rythme
              <br />
              lis à ta façon ♡
            </p>
          </div>

          <p
            className="
              font-handwritten text-xl
              leading-relaxed text-parchment
            "
          >
            un nouveau chapitre
            <br />
            commence ici ♡
          </p>
        </aside>

        <div
          className="
            flex flex-1 items-center justify-center
            px-6 py-12
            sm:px-10
            lg:px-16
          "
        >
          <div className="w-full max-w-lg">
            <div className="mb-10 md:hidden">
              <p className="font-heading text-4xl font-bold text-darkwood">
                Dear Pages ♡
              </p>
            </div>

            <header className="mb-9">
              <h1
                className="
                  font-heading text-4xl font-bold
                  text-darkwood sm:text-5xl
                "
              >
                {title}
              </h1>

              <p
                className="
                  mt-2 font-handwritten
                  text-xl text-walnut
                "
              >
                {subtitle}
              </p>
            </header>

            {children}

            <p className="mt-8 text-center text-sm text-walnut">
              {footerText}{' '}
              <Link
                to={footerLinkTo}
                className="
                  font-bold text-forest underline
                  decoration-forest/40 underline-offset-4
                  transition-opacity hover:opacity-70
                "
              >
                {footerLinkText}
              </Link>
            </p>

            <p
              className="
                mt-14 text-right font-handwritten
                text-lg text-olive
              "
            >
              les mêmes pages,
              <br />
              des jours plus doux ♡
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default AuthLayout