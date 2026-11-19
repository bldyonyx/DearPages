// Enable only after the dedicated RTDB rules are in place.
export const productionBookHistoryEnabled = import.meta.env.PROD &&
  import.meta.env.VITE_LEGACY_BOOK_HISTORY === 'true'
