import assert from 'node:assert/strict'
import test from 'node:test'
import { api } from '../src/client/api.js'

test('sends only the session id as the workspace authority', async () => {
  let request: RequestInit | undefined
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, init) => {
    request = init
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  try {
    await api.repositories({ sessionId: 'session-1', cwd: '/client-controlled' })
    assert.deepEqual(JSON.parse(String(request?.body)), { sessionId: 'session-1' })
  } finally {
    globalThis.fetch = originalFetch
  }
})
