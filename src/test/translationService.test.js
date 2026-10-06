import { afterEach, describe, expect, it, vi } from 'vitest'

async function importTranslationService(hasApiKey = true) {
  vi.resetModules()

  if (hasApiKey) {
    vi.stubEnv('VITE_GOOGLE_TRANSLATION_API_KEY', 'test-key')
  } else {
    vi.stubEnv('VITE_GOOGLE_TRANSLATION_API_KEY', '')
  }

  return import('../services/translationService.js')
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('translateText diagnostics', () => {
  it('preserves sanitized Google error metadata on non-2xx responses', async () => {
    const { translateText } = await importTranslationService()
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: vi.fn().mockResolvedValue({
        error: {
          code: 403,
          status: 'PERMISSION_DENIED',
          message:
            'Requests from referer https://dear-pages-booktracker.web.app are blocked.',
          errors: [
            {
              reason: 'forbidden',
              message: 'Request blocked.',
            },
          ],
        },
      }),
    })

    vi.stubGlobal('fetch', fetchMock)

    await expect(
      translateText('English source text', 'en', 'fr')
    ).rejects.toMatchObject({
      status: 403,
      apiError: {
        code: 403,
        status: 'PERMISSION_DENIED',
        message:
          'Requests from referer https://dear-pages-booktracker.web.app are blocked.',
      },
      diagnostic: {
        status: 403,
        googleErrorCode: 403,
        googleErrorStatus: 'PERMISSION_DENIED',
        googleErrorReason: 'forbidden',
        hasApiKey: true,
        hasHttpResponse: true,
      },
    })

    try {
      await translateText('English source text', 'en', 'fr')
    } catch (error) {
      expect(error.diagnostic.googleErrorMessage).not.toContain(
        'English source text'
      )
      expect(error.diagnostic.googleErrorMessage).not.toContain(
        'test-key'
      )
    }
  })

  it('marks network failures as missing an HTTP response', async () => {
    const { translateText } = await importTranslationService()

    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    )

    await expect(
      translateText('English source text', 'en', 'fr')
    ).rejects.toMatchObject({
      diagnostic: {
        status: null,
        googleErrorCode: null,
        googleErrorStatus: null,
        googleErrorMessage: null,
        googleErrorReason: null,
        hasApiKey: true,
        hasHttpResponse: false,
      },
    })
  })
})
