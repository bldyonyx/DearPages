function WelcomeStep({
  displayName,
  onNext,
}) {
  const firstName = displayName?.trim().split(/\s+/)[0]

  return (
    <div>
      <p className="font-handwritten text-xl text-walnut sm:text-2xl">
        un nouveau chapitre commence
      </p>

      <h1
        className="
          mt-3 max-w-2xl font-heading
          text-3xl font-bold leading-tight text-darkwood
          sm:text-5xl
        "
      >
        Bienvenue sur Dear Pages{firstName ? `, ${firstName}` : ''} ♡
      </h1>

      <p
        className="
          mt-5 max-w-2xl text-sm leading-relaxed
          text-darkwood/65 sm:text-base
        "
      >
        On va personnaliser ton espace de lecture avec quelques
        préférences simples, pour que tes prochaines découvertes te
        ressemblent davantage.
      </p>

      <div className="mt-10">
        <button
          type="button"
          onClick={onNext}
          className="
            w-full rounded-2xl bg-lime px-6 py-4
            text-sm font-bold text-darkwood
            transition hover:-translate-y-0.5 hover:brightness-95
            focus-visible:outline-none focus-visible:ring-2
            focus-visible:ring-olive/35
            sm:w-auto
          "
        >
          Commencer
        </button>
      </div>
    </div>
  )
}

export default WelcomeStep
