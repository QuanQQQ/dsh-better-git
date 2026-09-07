import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
const emittedFiles = (await readdir(new URL('../lib/', import.meta.url), { withFileTypes: true }))
  .filter(entry => entry.isFile())
  .map(entry => entry.name)
  .sort()

assert.doesNotMatch(client, /\bprocess\.env\./, 'client bundle must not depend on Node process.env')
assert.doesNotMatch(client, /require\(["']react-diff-view/, 'react-diff-view must be bundled')
assert.match(client, /dsh-better-git\/react-diff-view\.css/, 'official diff stylesheet must be injected')
assert.deepEqual(emittedFiles, ['client.js', 'client.js.map', 'host.mjs'], 'DSH client must remain a single JavaScript bundle')

console.log('client bundle checks passed')
