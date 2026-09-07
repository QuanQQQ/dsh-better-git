import assert from 'node:assert/strict'
import test from 'node:test'
import { apply } from '../src/index.js'

test('registers the Better Git Host route with an HMR disposer', async () => {
  let route: {
    kind: string
    path: string
    handler: (request: never, response: never) => void | Promise<void>
  } | undefined
  let disposed = false
  const context = {
    sessions: { get: () => undefined },
    webRuntime: { lanAddresses: [], trustedHosts: [] },
    webServer: {
      register(value: typeof route) {
        route = value
        return () => { disposed = true }
      },
    },
    effect(callback: () => void | (() => void)) {
      const dispose = callback()
      if (typeof dispose === 'function') dispose()
    },
  }

  apply(context as never)

  assert.equal(route?.kind, 'prefix')
  assert.equal(route?.path, '/better-git/api')
  assert.equal(disposed, true)

  let statusCode = 0
  let body = ''
  const request = {
    headers: { host: '127.0.0.1:3000' },
    method: 'GET',
    url: '/better-git/api/git.status',
  }
  const response = {
    setHeader() {},
    end(value: string) { body = value },
    get statusCode() { return statusCode },
    set statusCode(value: number) { statusCode = value },
  }
  await route?.handler(request as never, response as never)
  assert.equal(statusCode, 405)
  assert.deepEqual(JSON.parse(body), { error: 'method not allowed' })
})
