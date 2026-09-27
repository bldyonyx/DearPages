import { Search, X } from 'lucide-react'

import { libraryLarge } from './libraryResponsive.js'
import Input from '../ui/Input.jsx'

function LibrarySearchField({
  id,
  search,
  onSearchChange,
  onClearSearch,
  autoFocus = false,
}) {
  return (
    <div className="relative">
      <Search
        aria-hidden="true"
        strokeWidth={1.8}
        className="
          pointer-events-none
          absolute left-5 top-1/2 z-10
          h-5 w-5 -translate-y-1/2
          text-darkwood/50
          [@media_(min-width:2200px)_and_(min-height:1100px)]:h-6
          [@media_(min-width:2200px)_and_(min-height:1100px)]:w-6
          [@media_(min-width:2400px)_and_(min-height:1300px)]:left-6
        "
      />

      <Input
        id={id}
        type="search"
        value={search}
        onChange={(event) =>
          onSearchChange(event.target.value)
        }
        placeholder="Rechercher dans ma bibliothèque..."
        aria-label="Rechercher dans ma bibliothèque"
        autoFocus={autoFocus}
        className={`
          w-full rounded-full!
          py-3 pl-13 pr-12
          ${libraryLarge.searchInput}
        `}
      />

      {search && (
        <button
          type="button"
          onClick={onClearSearch}
          aria-label="Effacer la recherche"
          className="
            absolute right-4 top-1/2 z-10
            flex h-7 w-7
            -translate-y-1/2
            cursor-pointer
            items-center justify-center
            rounded-full
            text-darkwood/50
            transition-colors
            hover:text-darkwood
            [@media_(min-width:2200px)_and_(min-height:1100px)]:right-5
            [@media_(min-width:2200px)_and_(min-height:1100px)]:h-8
            [@media_(min-width:2200px)_and_(min-height:1100px)]:w-8
            [@media_(min-width:2400px)_and_(min-height:1300px)]:right-6
          "
        >
          <X
            aria-hidden="true"
            strokeWidth={1.8}
            className="
              h-4 w-4
              [@media_(min-width:2200px)_and_(min-height:1100px)]:h-5
              [@media_(min-width:2200px)_and_(min-height:1100px)]:w-5
            "
          />
        </button>
      )}
    </div>
  )
}

export default LibrarySearchField
