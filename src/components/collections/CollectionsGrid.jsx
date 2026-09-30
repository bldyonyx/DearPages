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
          sm:grid-cols-2
          xl:grid-cols-3
          ${collectionsLarge.gridGap}
          ${collectionsLarge.collectionGrid}
        `}
      >
        {collections.map((collection) => (
          <CollectionCard
            key={collection.id}
            collection={collection}
            previewBooks={getPreviewBooks(collection)}
            onDeleteRequest={onDeleteCollection}
            onEditRequest={onEditCollection}
            onPinRequest={onPinCollection}
          />
        ))}
      </div>
    </section>
  )
}

export default CollectionsGrid
