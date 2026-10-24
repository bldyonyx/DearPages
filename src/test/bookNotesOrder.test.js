import { expect, it } from 'vitest'
import { compareBookNotes } from '../utils/bookNotesOrder.js'
it('groups strict boolean pins and preserves date, creation and ID order within groups', () => {
  const notes = [
    { id: 'new', date: '2026-01-01', createdAt: 5 },
    { id: 'legacy-review-v1', date: '2020-01-01', createdAt: 1, isPinned: true },
    { id: 'b', date: '2020-01-01', createdAt: 2, isPinned: true },
    { id: 'a', date: '2020-01-01', createdAt: 2, isPinned: true },
    { id: 'old', date: '2010-01-01', createdAt: 9, isPinned: false },
  ]
  expect(notes.sort(compareBookNotes).map(n => n.id)).toEqual(['a', 'b', 'legacy-review-v1', 'new', 'old'])
})
