import CollectionCard from './cards/CollectionCard.jsx'

function CollectionsGrid({
  collections,
  getPreviewBooks,
  onDeleteCollection,
  onEditCollection,
  onPinCollection,
}) {
  return (
    <section className="mt-8">
      <div
        className="
          grid gap-5
          sm:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]
          xl:grid-cols-3
        "
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