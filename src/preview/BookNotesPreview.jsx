import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import '../i18n/index.js'
import '../index.css'
import BookNotesView from '../components/books/BookNotesView.jsx'
import BookRatingsView from '../components/books/BookRatingsView.jsx'
import BookDetails from '../components/books/BookDetails.jsx'
import RemoveBookModal from '../components/books/RemoveBookModal.jsx'
import usePreviewRatings from './usePreviewRatings.js'
import { compareBookNotes } from '../utils/bookNotesOrder.js'
import { todayCivilDate } from '../utils/civilDateUtils.js'

// This entry imports the pure view only. No Firebase SDK, service or auth provider.
const examples = [
  { id: 'sample-a', title: 'Une phrase à garder', date: '2026-10-24', contentHtml: '<p><b>On ne voit bien qu’avec le cœur.</b></p><p>Une pensée toute simple, qui change pourtant le regard sur le monde.</p>' },
  { id: 'sample-b', title: '', date: '2026-10-20', contentHtml: '<p>J’aime la douceur de cette rencontre et <i>ce qu’elle laisse entre les lignes</i>.</p>' },
]
const scenarios = { populated: 'Plusieurs notes', empty: 'Liste vide', historical: 'Ancienne note', deleted: 'Copie historique supprimée', conflict: 'Conflit historique', invalid: 'Source invalide', loading: 'Chargement', error: 'Erreur de lecture' }

export default function BookNotesPreview() {
  const { t, i18n } = useTranslation()
  const [scenario, setScenario] = useState('populated')
  const [notes, setNotes] = useState(examples)
  const [errors, setErrors] = useState({})
  const [fail, setFail] = useState(false)
  const ratingsModel = usePreviewRatings(fail)
  const [readingStatus, setReadingStatus] = useState('finished')
  const [inLibrary, setInLibrary] = useState(true)
  const [removing, setRemoving] = useState(false)
  const [abandonedAt, setAbandonedAt] = useState(() => new Date(2026, 2, 1, 12).getTime())
  const [finishedAt, setFinishedAt] = useState(() => new Date(2024, 5, 1, 12).getTime())
  const [processed, setProcessed] = useState({})
  const [conversionStatus, setConversionStatus] = useState('')
  const review = '<p>Une lecture pleine de tendresse.</p>'
  const legacy = processed.note ? { status: 'processed' } : scenario === 'historical' ? { status: 'unprocessed', contentHtml: '<p><b>Ma toute première pensée sur ce livre.</b></p><p>Cette note est conservée en lecture seule.</p>', sourceVersion: 'a'.repeat(64) }
    : { status: scenario === 'deleted' ? 'processed' : scenario === 'invalid' ? 'invalid' : scenario === 'conflict' ? 'conflict' : 'empty' }
  const legacyReview = processed.review ? { status: 'processed' } : { status: 'unprocessed', contentHtml: review, sourceVersion: 'b'.repeat(64) }
  const perform = (key, next, error = 'saveError') => {
    if (fail) { setErrors((current) => ({ ...current, [key]: error })); return false }
    setErrors({}); setNotes([...next].sort(compareBookNotes)); return true
  }
  const model = {
    enabled: true, loaded: scenario !== 'loading' && scenario !== 'error', loading: scenario === 'loading', loadError: scenario === 'error',
    notes, legacy, legacyReview, conversionStatus, pending: {}, errors,
    convert: async (kind, options) => {
      if (fail) { setErrors((current) => ({ ...current, [`convert:${kind}`]: 'conversionError' })); return false }
      if (processed[kind]) return true
      const id = kind === 'note' ? 'legacy-note-v1' : 'legacy-review-v1'
      const source = kind === 'note' ? legacy : legacyReview
      setNotes((current) => [...current.filter((note) => note.id !== id), { id, title: options.title || '', date: todayCivilDate(), contentHtml: source.contentHtml }].sort(compareBookNotes))
      setProcessed((current) => ({ ...current, [kind]: true }))
      setConversionStatus('converted'); setErrors({}); return true
    },
    create: async (input) => perform('new', [...notes, { ...input, id: crypto.randomUUID() }]),
    pin: async (id, isPinned) => perform(id, notes.map((note) => note.id === id ? { ...note, isPinned } : note), 'pinError'),
    save: async (id, input) => perform(id, notes.map((note) => note.id === id ? { ...note, ...input } : note)),
    remove: async (id) => {
      if (fail) { setErrors((current) => ({ ...current, [id]: 'deleteError' })); return false }
      return perform(id, notes.filter((note) => note.id !== id))
    },
    reload: async () => { if (scenario === 'error') setScenario('empty') },
  }
  const previewBook = { id: 'preview-book', title: 'Le Petit Prince', authors: ['Antoine de Saint-Exupéry'], categories: [], cover: null }
  const previewLibraryBook = inLibrary ? { ...previewBook, status: readingStatus, finishedAt, abandonedAt } : null
  const statusOptions = ['to-read', 'reading', 'finished', 'abandoned'].map(value => ({ value, labelKey: `status.${value}` }))
  return (
    <main data-book-notes-preview className="min-h-screen bg-cream px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <aside aria-label="Commandes de l’aperçu" className="mb-8 flex flex-wrap items-center gap-4 rounded-2xl border border-walnut/15 bg-mintcream/35 p-4 font-ui text-xs text-walnut">
          <p>Aperçu local · données fictives · aucune connexion Firebase</p>
          <label>État <select value={scenario} onChange={(event) => {
            const value = event.target.value; setScenario(value); setErrors({}); setProcessed({}); setConversionStatus('')
            setNotes(value === 'populated' ? examples : value === 'conflict' ? [{ ...examples[0], id: 'legacy-note-v1' }] : [])
          }} className="rounded-lg border border-walnut/20 bg-cream p-2">
            {Object.entries(scenarios).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
          <label><input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} /> Simuler un échec</label>
          <label><input type="checkbox" checked={ratingsModel.historical} onChange={event => ratingsModel.setHistorical(event.target.checked)} /> Ancienne évaluation à convertir</label>
          <label>Langue <select value={i18n.resolvedLanguage} onChange={(event) => i18n.changeLanguage(event.target.value)} className="rounded-lg border border-walnut/20 bg-cream p-2"><option value="fr">FR</option><option value="en">EN</option></select></label>
        </aside>
        <header aria-label="Informations du livre">
          <BookDetails book={previewBook} libraryBook={previewLibraryBook} statusOptions={statusOptions}
            onStatusChange={status => { setReadingStatus(status); setInLibrary(true) }} onAddToLibrary={() => { setReadingStatus('to-read'); setInLibrary(true) }}
            onRemoveFromLibrary={() => setRemoving(true)}
            onReadingDateChange={async value => { if (readingStatus === 'finished') setFinishedAt(value); else setAbandonedAt(value) }} />
        </header>
        <RemoveBookModal isOpen={removing} isRemoving={false} onCancel={() => setRemoving(false)} onConfirm={() => { setInLibrary(false); setRemoving(false) }} />
        <section aria-label="Mon espace de lecture" className="mt-10">
          <p className="font-handwritten text-lg text-olive">entre toi et les pages ♡</p>
          <h2 className="mb-5 font-heading text-3xl font-bold text-darkwood">Mon espace</h2>
          <div className="rounded-3xl border border-darkwood/10 bg-cream/80 p-6 shadow-[0_8px_30px_rgba(83,55,76,0.07)] sm:p-7">
            {inLibrary && readingStatus === 'finished' && <div className="mb-8"><BookRatingsView model={ratingsModel} /></div>}
            {inLibrary ? <BookNotesView key={scenario} model={model} historicalReview={review} /> : <p className="font-ui text-sm text-walnut">{t('bookPage.personal.locked')}</p>}
          </div>
        </section>
      </div>
    </main>
  )
}
