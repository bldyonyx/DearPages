// Unknown civil dates sort last. Technical edit/conversion times never date an evaluation.
export function compareBookRatings(a, b) {
  return (b.date || '').localeCompare(a.date || '') || b.createdAt - a.createdAt || a.id.localeCompare(b.id)
}
