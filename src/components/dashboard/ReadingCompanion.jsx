import sleepingCat from '../../assets/images/cats/sleeping-cat.png'

function ReadingCompanion() {
  return (
    <section
      className="
        flex w-full
        flex-col items-center justify-center
        gap-5
        sm:flex-row
        min-[1380px]:w-auto
        min-[1380px]:flex-none
        min-[1380px]:gap-6
      "
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
          alt="Petit chat tortoiseshell endormi"
          className="
            h-auto
            w-64
            shrink-0
            object-contain
            lg:w-72
            min-[1380px]:w-64
            min-[1750px]:w-72
          "
        />
      </div>

      {/* Petite note */}
      <div
        className="
          w-64 shrink-0
          rounded-2xl
          border border-darkwood/10
          bg-cream/80
          px-5 py-5
          text-center
          min-[1750px]:w-72
          min-[1750px]:px-7
        "
      >
        <p className="font-handwritten text-xl leading-relaxed text-darkwood">
          Encore un chapitre,
          <br />
          puis juste un dernier...
          <br />
          ♡
        </p>
      </div>
    </section>
  )
}

export default ReadingCompanion