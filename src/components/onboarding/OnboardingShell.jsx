function OnboardingShell({
  children,
  currentStep,
  totalSteps,
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
          mx-auto flex w-full max-w-6xl
          overflow-hidden rounded-[28px]
          bg-cream shadow-xl
          md:min-h-[720px]
          lg:min-h-[760px]
        "
      >
        <aside
          className="
            relative hidden w-[32%] shrink-0
            flex-col justify-between overflow-hidden
            px-10 py-14 text-cream
            md:flex lg:w-[34%]
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
            <p
              className="
                font-heading text-5xl font-bold
                leading-[0.9] tracking-wide text-cream
              "
            >
              Dear
              <br />
              Pages ♡
            </p>

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
            min-w-0 flex-1 px-5 py-7
            sm:px-8 sm:py-9
            md:px-10 md:py-12
            lg:px-14 xl:px-16
          "
        >
          <div className="mx-auto w-full max-w-3xl">
            <header className="flex items-start justify-between gap-4 md:justify-end">
              <p
                className="
                  font-heading text-3xl font-bold leading-none
                  text-darkwood sm:text-4xl md:hidden
                "
              >
                Dear Pages ♡
              </p>

              <div
                className="
                  flex shrink-0 items-center gap-2
                  rounded-full border border-walnut/15
                  bg-mintcream px-3 py-1.5
                  text-xs font-bold text-walnut
                "
              >
                <span>{currentStep + 1}</span>
                <span className="text-walnut/40">/</span>
                <span>{totalSteps}</span>
              </div>
            </header>

            <div
              className="
                mt-8
                sm:mt-10
              "
            >
              {children}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

export default OnboardingShell