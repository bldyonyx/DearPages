import littleCats from '../../../assets/images/little-cats.jpg'

function SidebarNote() {
  return (
    <div className="flex shrink-0 justify-center">
      <div
        aria-hidden="true"
        className="
          relative
          h-[155px] w-[120px]
          -rotate-3
          overflow-hidden

          lg:h-[205px]
          lg:w-[155px]

          [@media(min-height:1000px)]:lg:h-[235px]
          [@media(min-height:1000px)]:lg:w-[178px]

          [@media(min-height:1200px)]:lg:h-[270px]
          [@media(min-height:1200px)]:lg:w-[204px]

          [@media(min-height:1400px)]:lg:h-[300px]
          [@media(min-height:1400px)]:lg:w-[227px]
        "
      >
        <img
          src={littleCats}
          alt=""
          className="
            absolute
            left-1/2 top-0
            h-full
            w-[200px]
            max-w-none
            -translate-x-1/2

            lg:w-[250px]

            [@media(min-height:1000px)]:lg:w-[287px]
            [@media(min-height:1200px)]:lg:w-[330px]
            [@media(min-height:1400px)]:lg:w-[365px]
          "
        />

        <div
          className="
            pointer-events-none
            absolute
            left-1/2
            top-[59%]
            w-[88%]
            -translate-x-1/2
            -translate-y-1/2
            text-center
            text-ink
          "
        >
          <p
            className="
              font-handwritten
              text-[15px]
              leading-[1.15]

              lg:text-[19px]

              [@media(min-height:1000px)]:lg:text-[22px]
              [@media(min-height:1200px)]:lg:text-[25px]
              [@media(min-height:1400px)]:lg:text-[28px]
            "
          >
            La lecture
            <br />
            agrandit l’âme.
          </p>

          <p
            className="
              mt-2
              font-handwritten
              text-[11px]

              lg:text-[14px]

              [@media(min-height:1000px)]:lg:mt-2.5
              [@media(min-height:1000px)]:lg:text-[16px]

              [@media(min-height:1200px)]:lg:mt-3
              [@media(min-height:1200px)]:lg:text-[18px]

              [@media(min-height:1400px)]:lg:text-[20px]
            "
          >
            — Voltaire
          </p>
        </div>
      </div>
    </div>
  )
}

export default SidebarNote