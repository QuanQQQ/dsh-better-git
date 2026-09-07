import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { runInNewContext } from 'node:vm'
import test from 'node:test'

const exec = promisify(execFile)

test('packed artifact exposes loadable Candidate Host and Client entries', async () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const temp = await mkdtemp(join(root, '.packed-artifact-'))
  try {
    const { stdout } = await exec('pnpm', ['pack', '--pack-destination', temp], {
      cwd: root,
      env: { ...process.env, PNPM_CONFIG_AUTO_INSTALL_PEERS: 'false' },
    })
    const tarball = resolve(root, stdout.trim().split('\n').at(-1)!)
    await exec('tar', ['-xzf', tarball, '-C', temp])
    const packageRoot = join(temp, 'package')
    const manifest = JSON.parse(await readFile(join(packageRoot, 'package.json'), 'utf8'))
    assert.equal(manifest.exports['.'].default, './lib/host.mjs')
    assert.equal(manifest.exports['./client'].types, './lib/types/client/index.d.ts')
    assert.equal(manifest.exports['./client'].default, './lib/client.js')
    await readFile(join(packageRoot, 'lib/types/index.d.ts'))
    await readFile(join(packageRoot, 'lib/types/client/index.d.ts'))

    const host = await import(pathToFileURL(join(packageRoot, 'lib/host.mjs')).href)
    assert.deepEqual(Object.keys(host).sort(), ['apply', 'inject', 'name'])

    let clientFactory: ((require: (id: string) => unknown) => Record<string, unknown>) | undefined
    const clientCode = await readFile(join(packageRoot, 'lib/client.js'), 'utf8')
    assert.doesNotMatch(clientCode, /dsh-client-runtime|dsh-client-ui-slots|dsh-better-sidebar/)
    runInNewContext(clientCode, {
      window: {
        __ModuleLoader__: {
          load(entry: { id: string; factory: typeof clientFactory }) {
            assert.equal(entry.id, 'dsh-better-git')
            clientFactory = entry.factory
          },
        },
      },
    })
    const client = clientFactory?.((id) => {
      if (id === 'react') return {}
      if (id === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null }
      throw new Error(`unexpected packed client import: ${id}`)
    })
    assert.deepEqual(Object.keys(client ?? {}).sort(), ['apply', 'inject', 'name'])
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
