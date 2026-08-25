import assert from 'node:assert/strict'
import test from 'node:test'
import { isTrustedBetterGitRequest } from '../src/trust-fence.js'

test('accepts same-origin loopback requests', () => {
  assert.equal(isTrustedBetterGitRequest({
    headers: { host: '127.0.0.1:3081', origin: 'http://127.0.0.1:3081' },
  }, []), true)
})

test('rejects cross-site and mismatched-origin requests', () => {
  assert.equal(isTrustedBetterGitRequest({
    headers: { host: '127.0.0.1:3081', 'sec-fetch-site': 'cross-site' },
  }, []), false)
  assert.equal(isTrustedBetterGitRequest({
    headers: { host: '127.0.0.1:3081', origin: 'http://evil.invalid' },
  }, []), false)
})

test('accepts configured non-loopback authorities only', () => {
  assert.equal(isTrustedBetterGitRequest({ headers: { host: 'devbox.example:3080' } }, ['devbox.example:3080']), true)
  assert.equal(isTrustedBetterGitRequest({ headers: { host: 'other.example:3080' } }, ['devbox.example:3080']), false)
})
