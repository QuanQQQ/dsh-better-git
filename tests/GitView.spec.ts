import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { GitView } from '../src/client/GitView.js'

test('does not rediscover repositories when an equivalent scope object is passed', async () => {
  const originalFetch = globalThis.fetch
  let repositoryRequests = 0
  let renderer: ReactTestRenderer | undefined

  globalThis.fetch = async (input) => {
    const url = String(input)
    if (!url.endsWith('/better-git/api/git.repositories')) {
      throw new Error(`Unexpected Better Git request: ${url}`)
    }
    repositoryRequests += 1
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    await act(async () => {
      renderer = create(createElement(GitView, {
        scope: { sessionId: 'session-1', cwd: '/workspace' },
      }))
    })
    assert.equal(repositoryRequests, 1)

    await act(async () => {
      renderer?.update(createElement(GitView, {
        scope: { sessionId: 'session-1', cwd: '/workspace' },
      }))
    })

    assert.equal(repositoryRequests, 1)
  } finally {
    renderer?.unmount()
    globalThis.fetch = originalFetch
  }
})

test('shows a partially staged file in both staged and unstaged groups', async () => {
  const originalFetch = globalThis.fetch
  let renderer: ReactTestRenderer | undefined

  globalThis.fetch = async (input) => {
    const method = String(input).split('/').at(-1)
    const payload = method === 'git.repositories'
      ? [{
          path: '/workspace/repo',
          relativePath: 'repo',
          name: 'repo',
          kind: 'nested',
          initialized: true,
          state: 'ready',
        }]
      : method === 'git.status'
        ? { isRepo: true, branch: 'main', entries: [{ path: 'dual.txt', xy: 'MM' }] }
        : method === 'git.branch'
          ? { current: 'main', names: ['main'] }
          : method === 'git.log'
            ? []
            : (() => { throw new Error(`Unexpected Better Git request: ${String(input)}`) })()
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }

  try {
    await act(async () => {
      renderer = create(createElement(GitView, {
        scope: { sessionId: 'session-1', cwd: '/workspace' },
      }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    assert.equal(renderer?.root.findAllByProps({ title: 'dual.txt' }).length, 2)
  } finally {
    renderer?.unmount()
    globalThis.fetch = originalFetch
  }
})
