// Public fictional metadata for the explicitly enabled local Emulator journey.
// Never stored or added automatically; uses the existing book page and add button.
export const generationDemoBook = Object.freeze({
  id: 'generation-demo-book', title: 'Le carnet des saisons',
  authors: Object.freeze(['Camille Exemple']), categories: Object.freeze(['Fiction']),
  description: 'Un livre fictif pour essayer sa bibliothèque locale.',
  publishedDate: '2026', source: 'emulator-demo',
})

// Additional public fixture for exercising multi-book Collections in the same UI.
export const generationDemoBooks = Object.freeze([generationDemoBook, Object.freeze({
  ...generationDemoBook, id: 'generation-demo-book-2', title: 'Les chemins de papier',
})])
