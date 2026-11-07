const failure = code => Object.assign(new Error(`historical-finalization/${code}`), { code: `historical-finalization/${code}` })

/** Internal REST capabilities shared by the two local server adapters. No SDK,
 * credential discovery, default fetch/token, endpoint from invocation or Auth write.
 * Real origins deliberately remain unavailable until the security policy exists.
 */
export function createLocalFirebaseRest({ request, assertAuthorized, getAccessToken } = {}) {
  if (typeof window !== 'undefined' || [request, assertAuthorized, getAccessToken].some(value => typeof value !== 'function')) throw failure('explicit-server-capabilities-required')
  assertAuthorized()
  async function call(url, options = {}) {
    assertAuthorized()
    const token = await getAccessToken()
    assertAuthorized()
    if (typeof token !== 'string' || !token) throw failure('explicit-service-credential-required')
    try { return await request(url, { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10000) }) }
    catch { throw failure('observation-or-commit-uncertain') }
  }
  const rootUrl = 'http://127.0.0.1:9000/.json?ns=demo-dear-pages&format=export'
  return Object.freeze({
    lookupAccount: async uid => {
      const response = await call('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/projects/demo-dear-pages/accounts:lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [uid] }),
      })
      if (!response.ok) throw failure('auth-observation-denied')
      return (await response.json()).users?.find(user => user.localId === uid)
    },
    readRoot: async () => {
      const response = await call(rootUrl, { headers: { 'X-Firebase-ETag': 'true' } })
      if (!response.ok) throw failure('root-observation-denied')
      return { etag: response.headers.get('etag'), text: await response.text() }
    },
    readRules: async () => {
      const response = await call('http://127.0.0.1:9000/.settings/rules.json?ns=demo-dear-pages')
      if (!response.ok) throw failure('unexpected-emulator-rules')
      return response.json()
    },
    compareAndSwapRoot: async (etag, root) => {
      if (typeof etag !== 'string' || !etag || etag === '*') throw failure('unbounded-or-unversioned-root')
      const response = await call(rootUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'if-match': etag }, body: JSON.stringify(root) })
      if (response.status === 412) return 'conflict'
      if (!response.ok) throw failure(response.status >= 500 ? 'observation-or-commit-uncertain' : 'commit-denied')
      return 'committed'
    },
  })
}
