import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import BookNotesEditor from '../components/books/BookNotesEditor.jsx'

function getEditor(container) {
  return container.querySelector('[contenteditable="true"]')
}

describe('BookNotesEditor HTML security', () => {
  beforeEach(() => {
    document.execCommand = vi.fn()
    document.queryCommandState = vi.fn(() => false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sanitizes unsafe stored HTML before rendering it', () => {
    const { container } = render(
      <BookNotesEditor
        value={
          '<p onclick="alert(1)">Hi<img src=x onerror=alert(1)> there</p>'
        }
        onChange={vi.fn()}
      />
    )

    expect(getEditor(container).innerHTML).toBe(
      '<p>Hi there</p>'
    )
  })

  it('emits sanitized HTML when editor content changes', () => {
    const onChange = vi.fn()
    const { container } = render(
      <BookNotesEditor value="" onChange={onChange} />
    )
    const editor = getEditor(container)

    editor.innerHTML =
      '<div><strong>Safe</strong><img src=x onerror=alert(1)> text</div>'
    fireEvent.input(editor)

    expect(onChange).toHaveBeenLastCalledWith(
      '<div><strong>Safe</strong> text</div>'
    )
  })

  it('does not rewrite normal typed content during input', () => {
    const onChange = vi.fn()
    const { container } = render(
      <BookNotesEditor value="" onChange={onChange} />
    )
    const editor = getEditor(container)

    editor.innerHTML = 'Fresh words'
    fireEvent.input(editor)

    expect(editor.innerHTML).toBe('Fresh words')
    expect(onChange).toHaveBeenLastCalledWith('Fresh words')
  })

  it('uses the same rich text style scope for empty and normal content', () => {
    const { container } = render(
      <BookNotesEditor
        value={'<font size="3">Normal words</font>'}
        onChange={vi.fn()}
      />
    )

    expect(getEditor(container)).toHaveClass(
      'dp-note-rich-text'
    )
  })

  it('keeps toolbar commands wired to execCommand', () => {
    const onChange = vi.fn()
    const { container } = render(
      <BookNotesEditor
        value="<p>Selected text</p>"
        onChange={onChange}
      />
    )

    fireEvent.click(
      screen.getByRole('button', { name: /Bold|Gras/ })
    )

    expect(document.execCommand).toHaveBeenCalledWith(
      'bold',
      false,
      null
    )
    expect(onChange).toHaveBeenLastCalledWith(
      getEditor(container).innerHTML
    )
  })

  it('applies supported font size commands from the toolbar', () => {
    render(
      <BookNotesEditor
        value="<p>Selected text</p>"
        onChange={vi.fn()}
      />
    )

    fireEvent.click(
      screen.getByRole('button', {
        name: /Text size|Taille du texte/,
      })
    )
    fireEvent.click(
      screen.getByRole('option', { name: /Large|Grand/ })
    )

    expect(document.execCommand).toHaveBeenCalledWith(
      'fontSize',
      false,
      '4'
    )
  })
})
