import CollectionCard from './cards/CollectionCard.jsx'
import { collectionsLarge } from './collectionsResponsive.js'

function CollectionsGrid({
  collections,
  getPreviewBooks,
  onDeleteCollection,
  onEditCollection,
  onPinCollection,
}) {
  return (
    <section className={`mt-8 ${collectionsLarge.sectionGap}`}>
      <div
        className={`
          grid gap-5
          sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]
          xl:grid-cols-3
          ${collectionsLarge.gridGap}
          ${collectionsLarge.collectionGrid}
        `}
      >
        {collections.map((collection) => (
          <div
            key={collection.id}
            className={`
              min-w-0
              rounded-3xl transition
            `}
          >
            <CollectionCard
              collection={collection}
              previewBooks={getPreviewBooks(collection)}
              onDeleteRequest={onDeleteCollection}
              onEditRequest={onEditCollection}
              onPinRequest={onPinCollection}
            />
          </div>
        ))}
      </div>
    </section>
  )
}

export default CollectionsGrid
