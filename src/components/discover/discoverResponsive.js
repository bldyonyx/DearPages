export const discoverLarge = {
  shell: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:pt-8
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:pb-3
    [@media_(min-width:2200px)_and_(min-height:1100px)]:p-8
    [@media_(min-width:2400px)_and_(min-height:1300px)]:p-10
  `,

  headerTop: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:py-4
    [@media_(min-width:2200px)_and_(min-height:1100px)]:py-5
    [@media_(min-width:2400px)_and_(min-height:1300px)]:py-6
  `,

  firstSectionGap: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:mt-10
    [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-10
    [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-12
  `,

  sectionStack: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:mt-12
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:space-y-12
    [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-12
    [@media_(min-width:2200px)_and_(min-height:1100px)]:space-y-14
    [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-14
    [@media_(min-width:2400px)_and_(min-height:1300px)]:space-y-16
  `,

  sectionGap: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:mt-9
    [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8
    [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-10
  `,

  gridGap: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:gap-6
    [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-8
    [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-10
  `,

  bookGrid: `
    [@media_(min-width:1800px)]:grid-cols-6
    [@media_(min-width:2400px)_and_(min-height:1300px)]:grid-cols-7
  `,

  card: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:py-7
    [@media_(min-width:2200px)_and_(min-height:1100px)]:p-8
    [@media_(min-width:2400px)_and_(min-height:1300px)]:p-10
  `,

  title: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-3xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-4xl
  `,

  featuredTitle: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-4xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-5xl
  `,

  pageTitle: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-5xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-6xl
  `,

  description: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
  `,

  pageDescription: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-3
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-lg
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-xl
  `,

  handwritten: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-2xl
  `,

  stackGap: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:mt-8
    [@media_(min-width:2200px)_and_(min-height:1100px)]:mt-8
    [@media_(min-width:2400px)_and_(min-height:1300px)]:mt-10
  `,

  cardInnerGap: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:gap-8
    [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-10
    [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-12
  `,

  bookWrap: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:max-w-48
    [@media_(min-width:2400px)_and_(min-height:1300px)]:max-w-56
  `,

  bookVisibility: `
    [&:nth-child(n+6)]:hidden
    [@media_(min-width:1800px)]:[&:nth-child(6)]:block
    [@media_(min-width:2400px)_and_(min-height:1300px)]:[&:nth-child(7)]:block
  `,

  bookTitle: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-2xl
  `,

  bookAuthor: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
  `,

  searchForm: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:max-w-3xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:max-w-4xl
  `,

  searchInput: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:py-3.5
    [@media_(min-width:2200px)_and_(min-height:1100px)]:pl-14
    [@media_(min-width:2200px)_and_(min-height:1100px)]:pr-14
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
    [@media_(min-width:2400px)_and_(min-height:1300px)]:py-4
    [@media_(min-width:2400px)_and_(min-height:1300px)]:pl-16
    [@media_(min-width:2400px)_and_(min-height:1300px)]:pr-16
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-lg
  `,

  iconButton: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:size-12
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-2xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:size-14
  `,

  actionText: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
  `,

  searchResultsBackButton: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
  `,

  searchResultsPanel: `
    [@media_(min-width:1400px)_and_(max-height:950px)]:p-6
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:p-8
    [@media_(min-width:2200px)_and_(min-height:1100px)]:p-9
    [@media_(min-width:2400px)_and_(min-height:1300px)]:p-10
  `,

  searchResultsWidth: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:max-w-none
    [@media_(min-width:2400px)_and_(min-height:1300px)]:max-w-none
  `,

  searchResultsHeader: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:gap-2
    [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-3
  `,

  searchResultsTitle: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-3xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-3xl
  `,

  searchResultsMeta: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-base
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
  `,

  searchResultsGrid: `
    sm:grid-cols-3
    lg:grid-cols-4
    xl:grid-cols-6
    [@media_(min-width:1800px)_and_(min-height:1050px)]:grid-cols-6
  `,

  searchResultsGridGap: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:gap-x-7
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:gap-y-14
    [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-x-8
    [@media_(min-width:2200px)_and_(min-height:1100px)]:gap-y-16
    [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-x-9
    [@media_(min-width:2400px)_and_(min-height:1300px)]:gap-y-[4.5rem]
  `,

  searchResultsCardWrap: `
    [@media_(min-width:1800px)_and_(min-height:1050px)_and_(max-width:2199px)]:max-w-44
    [@media_(min-width:2200px)_and_(min-height:1100px)]:max-w-48
    [@media_(min-width:2400px)_and_(min-height:1300px)]:max-w-48
  `,

  searchResultsBookTitle: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-xl
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-xl
  `,

  searchResultsBookAuthor: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:text-sm
    [@media_(min-width:2400px)_and_(min-height:1300px)]:text-base
  `,

  searchResultsEmptyPanel: `
    [@media_(min-width:2200px)_and_(min-height:1100px)]:px-8
    [@media_(min-width:2200px)_and_(min-height:1100px)]:py-16
    [@media_(min-width:2400px)_and_(min-height:1300px)]:py-18
  `,
}
