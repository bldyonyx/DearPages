import { describe, expect, it } from 'vitest'

import { sanitizeNoteHtml } from '../utils/noteHtmlSanitizer.js'

describe('sanitizeNoteHtml', () => {
  it('preserves plain text and supported formatting', () => {
    const html = [
      '<p>Hello <strong>bold</strong> text</p>',
      '<div><b>Nested <i>formats</i></b></div>',
      '<font size="2">small</font>',
      '<font size="3">normal</font>',
      '<font size="5">large</font>',
      'line<br>break',
    ].join('')

    expect(sanitizeNoteHtml(html)).toBe(html)
  })

  it('removes unsupported attributes from allowed tags', () => {
    expect(
      sanitizeNoteHtml(
        '<p style="color:red" onclick="alert(1)">hello</p>'
      )
    ).toBe('<p>hello</p>')
  })

  it('removes unsupported font sizes while preserving text', () => {
    expect(
      sanitizeNoteHtml('<font size="7">huge</font>')
    ).toBe('<font>huge</font>')
  })

  it('allows size only on font elements', () => {
    expect(
      sanitizeNoteHtml('<p size="5">paragraph</p>')
    ).toBe('<p>paragraph</p>')
  })

  it('removes executable and embedded content', () => {
    const sanitized = sanitizeNoteHtml(
      [
        '<script>alert(1)</script>',
        '<iframe src="https://example.com"></iframe>',
        '<object data="x"></object>',
        '<template><p>hidden</p></template>',
      ].join('')
    )

    expect(sanitized).not.toContain('<script')
    expect(sanitized).not.toContain('<iframe')
    expect(sanitized).not.toContain('<object')
    expect(sanitized).not.toContain('<template')
    expect(sanitized).not.toContain('alert')
  })

  it('removes images, svg, math, links, URLs, and event handlers', () => {
    const sanitized = sanitizeNoteHtml(
      [
        '<p>Keep ',
        '<img src="x" onerror="alert(1)">',
        '<svg><circle onload="alert(1)"></circle></svg>',
        '<math><mi>x</mi></math>',
        '<a href="javascript:alert(1)">this text</a>',
        '</p>',
      ].join('')
    )

    expect(sanitized).toBe('<p>Keep this text</p>')
  })

  it('preserves safe text from mixed pasted HTML', () => {
    const sanitized = sanitizeNoteHtml(
      [
        '<section>',
        'Before ',
        '<strong>safe</strong>',
        '<span style="font-size:99px"> text</span>',
        '<img src="x" onerror="alert(1)">',
        ' after',
        '</section>',
      ].join('')
    )

    expect(sanitized).toBe(
      'Before <strong>safe</strong> text after'
    )
  })
})
