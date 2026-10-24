import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import BookPersonalSpace from '../components/books/BookPersonalSpace.jsx'
import BookRatingsSection from '../components/books/BookRatingsSection.jsx'
import LibraryBookCard from '../components/library/LibraryBookCard.jsx'
import { MemoryRouter } from 'react-router-dom'
import * as ratings from '../services/bookRatingsService.js'
import * as library from '../services/libraryService.js'
import i18n from '../i18n/index.js'
import { compareBookRatings } from '../utils/bookRatingsOrder.js'
const fixture=vi.hoisted(()=>({enabled:true,ratings:[],legacy:{status:'empty'}}))
vi.mock('../services/bookRatingsService.js',()=>({
  get isBookRatingsUiEnabled(){return fixture.enabled},
  getBookRatingsForDisplay:vi.fn(),newBookRatingId:vi.fn(()=>'-stable'),createBookRating:vi.fn(),updateBookRatingEntry:vi.fn(),deleteBookRatingEntry:vi.fn(),migrateLegacyBookRating:vi.fn(),
  compareBookRatings:(a,b)=>(b.date||'').localeCompare(a.date||'')||b.createdAt-a.createdAt||a.id.localeCompare(b.id),
}))
vi.mock('../services/libraryService.js',()=>({
  BOOK_STATUSES:{FINISHED:'finished',ABANDONED:'abandoned',READING:'reading',TO_READ:'to-read'},
  updateBookFinishedAt:vi.fn(),updateBookAbandonedAt:vi.fn(),updateBookRating:vi.fn(),
}))
vi.mock('../services/collectionsService.js',()=>({getUserCollections:vi.fn(async()=>[])}))
vi.mock('../components/collections/modals/BookCollectionsModal.jsx',()=>({default:()=>null}))
vi.mock('../components/books/BookNotesSection.jsx',()=>({default:()=> <p>Notes et punaises conservées</p>}))
const entry=(id,value=3,date='2024-01-01')=>({id,value,date,revision:1,createdAt:1})
beforeEach(async()=>{
  vi.clearAllMocks();fixture.enabled=true;fixture.ratings=[];fixture.legacy={status:'empty'}
  ratings.getBookRatingsForDisplay.mockImplementation(async()=>({ratings:[...fixture.ratings].sort(compareBookRatings),legacy:fixture.legacy}))
  await i18n.changeLanguage('fr')
})
const ready=()=>waitFor(()=>expect(screen.getByRole('button',{name:'Ajouter une évaluation'})).toBeEnabled())
it.each(['finished','abandoned','reading','to-read'])('preserves visibility for %s without new rating reads for other statuses',async status=>{
  render(<BookPersonalSpace userId="u" bookId="b" libraryBook={{status}} onLibraryBookChange={vi.fn()} />)
  if(status==='finished'){await ready();expect(ratings.getBookRatingsForDisplay).toHaveBeenCalledTimes(1)}
  else{expect(screen.queryByRole('button',{name:'Ajouter une évaluation'})).not.toBeInTheDocument();expect(ratings.getBookRatingsForDisplay).not.toHaveBeenCalled()}
})
it.each(['finished','abandoned'])('keeps %s library dates while removing the date editor from personal space',async status=>{
  const book={id:'b',title:'Livre',authors:['Auteur'],status,finishedAt:new Date(2024,5,1,12).getTime(),abandonedAt:new Date(2023,8,1,12).getTime(),rating:4}
  render(<><BookPersonalSpace userId="u" bookId="b" libraryBook={book} onLibraryBookChange={vi.fn()} /><MemoryRouter><LibraryBookCard book={book} /></MemoryRouter></>)
  expect(screen.queryByRole('button',{name:/Modifier la date/})).not.toBeInTheDocument()
  expect(screen.getAllByText(status==='finished'?'Juin 2024':'Septembre 2023')).toHaveLength(1)
  expect(library.updateBookFinishedAt).not.toHaveBeenCalled()
  expect(library.updateBookAbandonedAt).not.toHaveBeenCalled()
})
it('preserves the entire library object when adding and deleting a rating',async()=>{
  const book=Object.freeze({status:'finished',rating:4,finishedAt:123,abandonedAt:456,metadata:{kept:true},note:'note',review:'review',updatedAt:17})
  const change=vi.fn();ratings.createBookRating.mockResolvedValue(entry('-stable'))
  render(<BookPersonalSpace userId="u" bookId="b" libraryBook={book} onLibraryBookChange={change} />)
  await ready()
  fireEvent.click(screen.getByRole('button',{name:'Ajouter une évaluation'}))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'3 étoiles'}))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Enregistrer'}))
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  fireEvent.click(screen.getByRole('button',{name:'Supprimer l’évaluation'}))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Supprimer'}))
  await waitFor(()=>expect(screen.queryByRole('article',{name:'Évaluation'})).not.toBeInTheDocument())
  expect(change).not.toHaveBeenCalled();expect(library.updateBookRating).not.toHaveBeenCalled();expect(library.updateBookFinishedAt).not.toHaveBeenCalled();expect(library.updateBookAbandonedAt).not.toHaveBeenCalled()
})
it('does not read or write new rating branches when disabled',()=>{
  fixture.enabled=false
  render(<BookRatingsSection userId="u" bookId="b" legacyControl={<p>Existing rating control</p>} />)
  expect(screen.getByText('Existing rating control')).toBeInTheDocument()
  expect(ratings.getBookRatingsForDisplay).not.toHaveBeenCalled()
})
it('does not auto-convert; keeps a processed source hidden if the post-conversion refresh fails',async()=>{
  fixture.legacy={status:'unprocessed',value:4}
  render(<BookRatingsSection userId="u" bookId="b" />);await ready()
  expect(ratings.migrateLegacyBookRating).not.toHaveBeenCalled()
  ratings.getBookRatingsForDisplay.mockRejectedValueOnce(new Error('offline'))
  fireEvent.click(screen.getByRole('button',{name:'Convertir l’ancienne évaluation'}))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'Confirmer la conversion'}))
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(screen.getByRole('status')).toHaveTextContent('Conversion enregistrée')
  expect(screen.queryByRole('button',{name:'Convertir l’ancienne évaluation'})).not.toBeInTheDocument()
})
it('ignores the old user/book scope when an in-flight load resolves',async()=>{
  let resolve
  ratings.getBookRatingsForDisplay.mockReturnValueOnce(new Promise(done=>{resolve=done}))
  const {rerender}=render(<BookRatingsSection userId="u" bookId="old" />)
  await waitFor(()=>expect(ratings.getBookRatingsForDisplay).toHaveBeenCalledWith('u','old'))
  rerender(<BookRatingsSection userId="other" bookId="new" />)
  await ready()
  await act(async()=>resolve({ratings:[entry('secret')],legacy:{status:'empty'}}))
  expect(screen.queryByRole('article',{name:'Évaluation'})).not.toBeInTheDocument()
})
it('locks duplicate submits and keeps the same creation ID on a failed attempt',async()=>{
  let reject
  ratings.createBookRating.mockReturnValueOnce(new Promise((_resolve,no)=>{reject=no})).mockResolvedValueOnce(entry('-stable'))
  render(<BookRatingsSection userId="u" bookId="b" />);await ready()
  fireEvent.click(screen.getByRole('button',{name:'Ajouter une évaluation'}))
  const dialog=screen.getByRole('dialog')
  fireEvent.click(within(dialog).getByRole('button',{name:'4 étoiles'}))
  fireEvent.click(within(dialog).getByRole('button',{name:'Enregistrer'}))
  expect(within(dialog).getByRole('button',{name:'Enregistrer'})).toBeDisabled()
  await act(async()=>reject(new Error('offline')))
  fireEvent.click(within(dialog).getByRole('button',{name:'Enregistrer'}))
  await waitFor(()=>expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  expect(ratings.createBookRating.mock.calls.map(args=>args[2])).toEqual(['-stable','-stable'])
})
it('retains a rating draft and the open history on manual refresh without saving automatically',async()=>{
  fixture.ratings=[entry('a',4,'2026-01-01'),entry('b',3)]
  render(<BookRatingsSection userId="u" bookId="b" />);await ready()
  fireEvent.click(screen.getByRole('button',{name:'Voir mes anciennes évaluations (1)'}))
  fireEvent.click(within(screen.getAllByRole('article',{name:'Évaluation'})[1]).getByRole('button',{name:'Modifier l’évaluation'}))
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button',{name:'2 étoiles'}))
  fixture.ratings=[entry('a',5,'2026-01-01'),{...entry('b',4),revision:2}]
  fireEvent.click(screen.getByRole('button',{name:'Actualiser les évaluations'}))
  await ready()
  expect(screen.getByRole('button',{name:'Masquer mes anciennes évaluations (1)'})).toHaveAttribute('aria-expanded','true')
  expect(within(screen.getByRole('dialog')).getByRole('button',{name:'2 étoiles'})).toHaveAttribute('aria-pressed','true')
  expect(ratings.updateBookRatingEntry).not.toHaveBeenCalled()
})
