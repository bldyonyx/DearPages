const inFlightRequests = new Map()

/**
 * Shares a single network request between simultaneous callers of the same URL.
 * This is especially useful in React StrictMode development, where effects are
 * intentionally remounted and can otherwise issue duplicate identical fetches.
 *
 * @param {string} url - Fully built request URL.
 * @returns {Promise<Object>} Parsed JSON response.
 * @throws {Error} If the response is not successful.
 */
export async function fetchJsonOnce(url) {
  if (inFlightRequests.has(url)) {
    return inFlightRequests.get(url)
  }

  const request = fetch(url)
    .then(async (response) => {
      if (!response.ok) {
        let body = null

        try {
          body = await response.json()
        } catch {
          body = null
        }

        const error = new Error('Impossible de recuperer les donnees.')
        error.status = response.status
        error.apiError = body?.error || null
        throw error
      }

      return response.json()
    })
    .finally(() => {
      inFlightRequests.delete(url)
    })

  inFlightRequests.set(url, request)

  return request
}
