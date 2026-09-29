import HeaderActions from '../layout/HeaderActions.jsx'

function CollectionsHeader({
  user,
  onCreateCollection,
}) {
  return (
    <header className="py-4">
      <div
        className="
          flex flex-col gap-4
          lg:flex-row lg:items-center lg:justify-between
        "
      >
        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold text-darkwood md:text-4xl">
            Mes collections
          </h1>

          <p className="mt-2 font-ui text-sm font-semibold text-darkwood/60 md:text-base">
            Des piles de livres rangées à ta façon.
          </p>
        </div>

        <div
          className="
            flex min-w-0 flex-wrap
            items-center gap-3
            lg:flex-1
            lg:flex-nowrap
            lg:justify-end
          "
        >
          <HeaderActions
            user={user}
            className="order-1 md:flex-none lg:order-2"
          />

          <div className="order-2 basis-full lg:order-1 lg:basis-auto">
            <button
              type="button"
              onClick={onCreateCollection}
              className="
                inline-flex h-10
                cursor-pointer
                shrink-0 items-center
                justify-center
                rounded-full border
                border-lime/70
                bg-lime/70 px-4
                font-bold text-darkwood
                shadow-sm
                hover:bg-lime
                md:h-11 md:px-5
              "
            >
              + Nouvelle collection
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}

export default CollectionsHeader