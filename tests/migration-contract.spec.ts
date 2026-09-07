import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
  dsh?: { client?: { inject?: string[] } }
  scripts?: Record<string, string>
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  devDependencies?: Record<string, string>
}

test('declares only the Better Sidebar client package edge', () => {
  assert.deepEqual(manifest.dsh?.client?.inject, ['dsh-better-sidebar'])
})

test('publishes typed Host and Client entrypoints', () => {
  assert.deepEqual((manifest as { exports?: unknown }).exports, {
    '.': { types: './lib/types/index.d.ts', default: './lib/host.mjs' },
    './client': { types: './lib/types/client/index.d.ts', default: './lib/client.js' },
    './package.json': './package.json',
  })
})

test('publishes only DSH 0.1.2 and current Better Sidebar runtime peers', () => {
  assert.deepEqual(manifest.peerDependencies, {
    '@deepseek-ai/cordis': '^4.0.2',
    '@deepseek-ai/dsh-host-webserver': '>=0.1.2-rc.1 <0.1.3-0',
    '@deepseek-ai/dsh-session': '>=0.1.2-rc.1 <0.1.3-0',
    '@deepseek-ai/dsh-web-app': '>=0.1.2-rc.1 <0.1.3-0',
    'dsh-better-sidebar': '>=0.17.0 <0.18.0',
  })
  for (const section of ['dependencies', 'peerDependencies', 'optionalDependencies'] as const) {
    assert.equal(Object.hasOwn(manifest[section] ?? {}, 'cordis'), false)
  }
  for (const legacy of [
    '@deepseek-ai/dsh-client-runtime',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-slots',
  ]) {
    assert.equal(Object.hasOwn(manifest.peerDependencies ?? {}, legacy), false)
    assert.equal(Object.hasOwn(manifest.devDependencies ?? {}, legacy), false)
  }
  assert.equal(Object.hasOwn(manifest.scripts ?? {}, 'prepare'), false)
})
