import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
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

test('rejects a client cwd for an unknown session', async () => {
  let handler: ((request: never, response: never) => void | Promise<void>) | undefined
  const context = {
    sessions: { get: () => undefined },
    webRuntime: { lanAddresses: [], trustedHosts: [] },
    webServer: {
      register(route: { handler: typeof handler }) {
        handler = route.handler
        return () => {}
      },
    },
    effect(callback: () => void | (() => void)) { callback() },
  }
  apply(context as never)

  const request = Readable.from([JSON.stringify({ sessionId: 'missing', cwd: process.cwd() })])
  Object.assign(request, {
    headers: { host: '127.0.0.1:3000' },
    method: 'POST',
    url: '/better-git/api/git.repositories',
  })
  let statusCode = 0
  let body = ''
  const response = {
    setHeader() {},
    end(value: string) { body = value },
    get statusCode() { return statusCode },
    set statusCode(value: number) { statusCode = value },
  }

  await handler?.(request as never, response as never)
  assert.equal(statusCode, 400)
  assert.deepEqual(JSON.parse(body), { error: 'unknown session "missing"' })
})

test('rejects a session without a Host working directory', async () => {
  let handler: ((request: never, response: never) => void | Promise<void>) | undefined
  const context = {
    sessions: { get: () => ({ header: {} }) },
    webRuntime: { lanAddresses: [], trustedHosts: [] },
    webServer: {
      register(route: { handler: typeof handler }) {
        handler = route.handler
        return () => {}
      },
    },
    effect(callback: () => void | (() => void)) { callback() },
  }
  apply(context as never)

  const request = Readable.from([JSON.stringify({ sessionId: 'without-cwd', cwd: process.cwd() })])
  Object.assign(request, {
    headers: { host: '127.0.0.1:3000' },
    method: 'POST',
    url: '/better-git/api/git.repositories',
  })
  let statusCode = 0
  let body = ''
  const response = {
    setHeader() {},
    end(value: string) { body = value },
    get statusCode() { return statusCode },
    set statusCode(value: number) { statusCode = value },
  }

  await handler?.(request as never, response as never)
  assert.equal(statusCode, 400)
  assert.deepEqual(JSON.parse(body), { error: 'session "without-cwd" has no working directory' })
})
