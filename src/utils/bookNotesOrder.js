// Pure ordering shared by the data service and the Firebase-free preview.
export function compareBookNotes(a, b) {
  return Number(b.isPinned === true) - Number(a.isPinned === true) ||
    b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0) || a.id.localeCompare(b.id)
}
