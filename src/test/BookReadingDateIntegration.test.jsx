import { useEffect } from 'react'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import BookDetails from '../components/books/BookDetails.jsx'
import BookPersonalSpace from '../components/books/BookPersonalSpace.jsx'
import LibraryBookCard from '../components/library/LibraryBookCard.jsx'
import { useBookLibraryState } from '../hooks/useBookLibraryState.js'
import * as library from '../services/libraryService.js'
import i18n from '../i18n/index.js'
vi.mock('../services/libraryService.js',()=>({
  BOOK_STATUSES:{FINISHED:'finished',ABANDONED:'abandoned',READING:'reading',TO_READ:'to-read'},
  getLibraryBook:vi.fn(),addBookToLibrary:vi.fn(),removeBookFromLibrary:vi.fn(),updateBookStatus:vi.fn(),
  updateBookFinishedAt:vi.fn(),updateBookAbandonedAt:vi.fn(),updateBookRating:vi.fn(),
}))
vi.mock('../services/collectionsService.js',()=>({getUserCollections:vi.fn(async()=>[])}))
vi.mock('../components/collections/modals/BookCollectionsModal.jsx',()=>({default:()=>null}))
vi.mock('../components/books/BookNotesSection.jsx',()=>({default:()=> <p>Notes et punaises conservées</p>}))
vi.mock('../components/books/BookRatingsSection.jsx',()=>({default:()=> <p>Historique des évaluations conservé</p>}))
const catalog={id:'b',title:'Livre',authors:['Auteur'],categories:[],cover:null}
const original={...catalog,status:'finished',rating:4,finishedAt:new Date(2024,5,1,12).getTime(),abandonedAt:new Date(2023,8,1,12).getTime(),note:'Note',review:'Avis',metadata:{kept:true},updatedAt:17}
const options=['to-read','reading','finished','abandoned'].map(value=>({value,labelKey:`status.${value}`}))
function Harness({routeKey='route',userId='u',expose}){
  const state=useBookLibraryState({book:catalog,bookId:'b',routeKey,userId})
  useEffect(()=>{expose?.(state)})
  return <><div data-testid="details"><BookDetails book={catalog} libraryBook={state.libraryBook} statusOptions={options}
    isLibraryLoading={state.isLibraryLoading} isSaving={state.isSaving} isReadingDateSaving={state.isReadingDateSaving}
    onReadingDateChange={state.handleReadingDateChange} readingDateMessage={state.readingDateMessage} libraryError={state.libraryError}
    onStatusChange={state.handleStatusChange} onRemoveFromLibrary={state.handleOpenRemoveModal} /></div>
    {state.libraryBook && <><div data-testid="personal"><BookPersonalSpace userId={userId} bookId="b" libraryBook={state.libraryBook} onLibraryBookChange={state.setLibraryBook} /></div>
    <MemoryRouter><LibraryBookCard book={state.libraryBook} /></MemoryRouter></>}
    <output data-testid="stored">{JSON.stringify(state.libraryBook)}</output></>
}
const details=()=>within(screen.getByTestId('details'))
const ready=()=>waitFor(()=>expect(details().queryByRole('button',{name:'Terminé'})).toBeEnabled())
beforeEach(async()=>{
  vi.clearAllMocks();library.getLibraryBook.mockResolvedValue(structuredClone(original))
  library.updateBookStatus.mockImplementation(async (_uid,_id,status)=>({status}))
  await i18n.changeLanguage('fr')
})
it.each(['finished','abandoned','reading','to-read'])('shows a date only for final library status %s, under the selector and never in personal space',async status=>{
  library.getLibraryBook.mockResolvedValue({...original,status})
  render(<Harness />)
  await waitFor(()=>expect(screen.getByTestId('stored')).toHaveTextContent(`"status":"${status}"`))
  const actions=details().queryAllByRole('button',{name:/Modifier la date/})
  expect(actions).toHaveLength(['finished','abandoned'].includes(status)?1:0)
  expect(within(screen.getByTestId('personal')).queryByText(/Lecture (terminée|abandonnée)/)).not.toBeInTheDocument()
  if(actions[0]){
    const statusButton=details().getByRole('button',{name:status==='finished'?'Terminé':'Abandonné'})
    expect(statusButton.closest('.relative').parentElement).toContainElement(actions[0])
    expect(statusButton.compareDocumentPosition(actions[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  }
})
it('does not show a date for a book outside the library',async()=>{
  library.getLibraryBook.mockResolvedValue(null)
  render(<Harness />)
  await waitFor(()=>expect(details().getByRole('button',{name:'+ Ajouter à ma bibliothèque'})).toBeEnabled())
  expect(details().queryByRole('button',{name:/la date/})).not.toBeInTheDocument()
})
it.each(['finished','abandoned'])('edits %s month/year, updates the library card and preserves all unrelated book fields',async status=>{
  const initial={...original,status}
  library.getLibraryBook.mockResolvedValue(initial)
  render(<Harness />)
  const title=status==='finished'?'Lecture terminée':'Lecture abandonnée'
  const edit=await details().findByRole('button',{name:`Modifier la date · ${title}`})
  await waitFor(()=>expect(edit).toBeEnabled())
  fireEvent.click(edit)
  fireEvent.click(details().getByRole('button',{name:status==='finished'?'Juin':'Septembre'}))
  fireEvent.click(screen.getByRole('button',{name:status==='finished'?'Juillet':'Octobre'}))
  fireEvent.click(details().getByRole('button',{name:'Enregistrer'}))
  const service=status==='finished'?library.updateBookFinishedAt:library.updateBookAbandonedAt
  const next=status==='finished'?new Date(2024,6,1,12).getTime():new Date(2023,9,1,12).getTime()
  await waitFor(()=>expect(service).toHaveBeenCalledWith('u','b',next))
  await waitFor(()=>expect(screen.getAllByText(status==='finished'?'Juillet 2024':'Octobre 2023')).toHaveLength(2))
  const book=JSON.parse(screen.getByTestId('stored').textContent)
  expect(book).toEqual({...initial,[status==='finished'?'finishedAt':'abandonedAt']:next,updatedAt:expect.any(Number)})
  expect(library.updateBookRating).not.toHaveBeenCalled();expect(library.updateBookStatus).not.toHaveBeenCalled()
})
it.each(['finished','abandoned'])('offers adding an unknown %s date',async status=>{
  library.getLibraryBook.mockResolvedValue({...original,status,finishedAt:null,abandonedAt:null})
  render(<Harness />)
  const edit=await details().findByRole('button',{name:`Ajouter la date · ${status==='finished'?'Lecture terminée':'Lecture abandonnée'}`})
  await waitFor(()=>expect(edit).toBeEnabled());fireEvent.click(edit)
  expect(details().getByRole('button',{name:'Enregistrer'})).toBeInTheDocument()
  fireEvent.click(details().getByRole('button',{name:'Enregistrer'}))
  const service=status==='finished'?library.updateBookFinishedAt:library.updateBookAbandonedAt
  await waitFor(()=>expect(service).toHaveBeenCalledWith('u','b',new Date(new Date().getFullYear(),new Date().getMonth(),1,12).getTime()))
})
it('keeps the editor and chosen month on a failed save, and exposes the error',async()=>{
  library.updateBookFinishedAt.mockRejectedValueOnce(new Error('offline'))
  render(<Harness />);await ready()
  fireEvent.click(details().getByRole('button',{name:'Modifier la date · Lecture terminée'}))
  fireEvent.click(details().getByRole('button',{name:'Juin'}));fireEvent.click(screen.getByRole('button',{name:'Juillet'}))
  fireEvent.click(details().getByRole('button',{name:'Enregistrer'}))
  await waitFor(()=>expect(details().getByRole('alert')).toHaveTextContent('Impossible'))
  expect(details().getByRole('button',{name:'Juillet'})).toBeInTheDocument()
  expect(JSON.parse(screen.getByTestId('stored').textContent)).toEqual(original)
})
it('blocks status/removal and duplicate date saves while an update is pending',async()=>{
  let resolve;library.updateBookFinishedAt.mockReturnValueOnce(new Promise(done=>{resolve=done}))
  let state;render(<Harness expose={value=>{state=value}} />);await ready()
  let first
  act(()=>{first=state.handleReadingDateChange(original.finishedAt)})
  expect(details().getByRole('button',{name:'Terminé'})).toBeDisabled()
  expect(details().getByRole('button',{name:'Retirer de ma bibliothèque'})).toBeDisabled()
  await act(async()=>{expect(await state.handleReadingDateChange(original.finishedAt)).toBe(false);await state.handleStatusChange('reading');state.handleOpenRemoveModal()})
  expect(library.updateBookFinishedAt).toHaveBeenCalledTimes(1);expect(library.updateBookStatus).not.toHaveBeenCalled();expect(state.isRemoveModalOpen).toBe(false)
  await act(async()=>{resolve();await first})
})
it('does not resurrect a locally removed book after an in-flight save completes',async()=>{
  let resolve;library.updateBookFinishedAt.mockReturnValueOnce(new Promise(done=>{resolve=done}))
  let state;render(<Harness expose={value=>{state=value}} />);await ready()
  let pending;act(()=>{pending=state.handleReadingDateChange(original.finishedAt)})
  act(()=>state.setLibraryBook(null))
  await act(async()=>{resolve();await pending})
  expect(screen.getByTestId('stored')).toHaveTextContent('null')
})
it('ignores an old save after route/user scope changes',async()=>{
  let resolve;library.updateBookFinishedAt.mockReturnValueOnce(new Promise(done=>{resolve=done}))
  let state;const {rerender}=render(<Harness expose={value=>{state=value}} />);await ready()
  let pending;act(()=>{pending=state.handleReadingDateChange(new Date(2025,0,1,12).getTime())})
  rerender(<Harness userId="other" routeKey="new" expose={value=>{state=value}} />)
  await ready()
  await act(async()=>{resolve();await pending})
  expect(JSON.parse(screen.getByTestId('stored').textContent)).toEqual(original)
})
