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

test('keeps commit controls and history in a separate pane when opening and closing diffs', async () => {
  const originalFetch = globalThis.fetch
  let renderer: ReactTestRenderer | undefined
  const historyEntry = {
    hash: '1234567', hashFull: '1234567890abcdef', subject: 'Initial commit',
    author: 'Test', date: '2026-01-01T00:00:00Z', refs: 'HEAD -> main',
  }
  globalThis.fetch = async (input) => {
    const method = String(input).split('/').at(-1)
    const payloads: Record<string, unknown> = {
      'git.repositories': [{ path: '/workspace/repo', name: 'repo', kind: 'nested', initialized: true }],
      'git.status': { isRepo: true, branch: 'main', entries: [{ path: 'file.txt', xy: 'M ' }] },
      'git.branch': { current: 'main', names: ['main'] },
      'git.log': [historyEntry],
      'git.diff': { diff: '' },
      'git.commit-diff': { diff: '' },
    }
    assert.ok(method !== undefined && method in payloads, `Unexpected request: ${String(input)}`)
    return Response.json(payloads[method])
  }

  try {
    await act(async () => {
      renderer = create(createElement(GitView, { scope: { sessionId: 'session-1', cwd: '/workspace' } }))
    })
    const root = renderer!.root
    const content = root.findByProps({ className: 'bgit-content' })
    const controls = root.findByProps({ className: 'bgit-controls' })
    const lists = controls.findByProps({ className: 'bgit-changes-history' })
    const composer = controls.findByProps({ 'aria-label': 'Commit changes' })
    const message = composer.findByProps({ 'aria-label': 'Commit message' })
    assert.equal(content.props['data-has-diff'], false)
    assert.equal(composer.parent, controls)
    assert.equal(lists.parent, controls)

    await act(async () => {
      message.props.onChange({ target: { value: 'Keep this draft' } })
      lists.findByProps({ title: 'file.txt' }).props.onClick()
    })
    assert.equal(content.props['data-has-diff'], true)
    assert.equal(root.findByProps({ className: 'bgit-diff' }).parent, content)
    assert.equal(controls.parent, content)
    assert.equal(message.props.value, 'Keep this draft')

    const history = lists.findAllByType('button').find(button => button.props['aria-expanded'] === false)!
    await act(async () => { history.props.onClick() })
    await act(async () => { lists.findByProps({ className: 'bgit-log-row' }).props.onClick() })
    assert.equal(root.findByProps({ className: 'bgit-diff' }).props['aria-label'], 'Commit · 1234567')
    assert.equal(root.findAllByProps({ role: 'alert' }).length, 0)
    assert.equal(history.props['aria-expanded'], true)
    assert.equal(message.props.value, 'Keep this draft')

    await act(async () => { root.findByProps({ 'aria-label': 'Close diff' }).props.onClick() })
    assert.equal(content.props['data-has-diff'], false)
    assert.equal(root.findAllByProps({ className: 'bgit-diff' }).length, 0)
    assert.equal(history.props['aria-expanded'], true)
    assert.equal(message.props.value, 'Keep this draft')
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
