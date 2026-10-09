
const inFlightRequests = new Map()

const OPEN_LIBRARY_TIMEOUT_MS = 5000

function isOpenLibraryApiUrl(url) {
  try {
    return new URL(url).hostname === 'openlibrary.org'
  } catch {
    return false
  }
}

/**
 * Shares a single network request between simultaneous callers
 * of the same URL.
 *
 * Open Library API requests have a timeout so an outage cannot
 * indefinitely block the application.
 *
 * @param {string} url - Fully built request URL.
 * @returns {Promise<Object>} Parsed JSON response.
 * @throws {Error} If the request fails or times out.
 */
export async function fetchJsonOnce(url) {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)
  }

  const useTimeout = isOpenLibraryApiUrl(url)
  const controller = useTimeout
    ? new AbortController()
    : null

  let timeoutId

  const request = (async () => {
    try {
      if (controller) {
        timeoutId = setTimeout(() => {
          controller.abort()
        }, OPEN_LIBRARY_TIMEOUT_MS)
      }

      const response = await fetch(
        url,
        controller
          ? { signal: controller.signal }
          : undefined
      )

      if (!response.ok) {
        let body = null

        try {
          body = await response.json()
        } catch {
          body = null
        }

        const error = new Error(
          'Impossible de recuperer les donnees.'
        )

        error.status = response.status
        error.apiError = body?.error || null

        throw error
      }

      return await response.json()
    } catch (error) {
      if (
        controller?.signal.aborted &&
        error?.name === 'AbortError'
      ) {
        throw new Error(
          'Open Library ne repond pas dans le delai imparti.'
        )
      }

      throw error
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId)
      }

      inFlightRequests.delete(url)
    }
  })()

  inFlightRequests.set(url, request)

  return request
}
