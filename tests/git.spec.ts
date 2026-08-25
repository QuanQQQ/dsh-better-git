import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test from 'node:test'
import {
  discoverRepositories,
  initializeSubmodule,
  parseLogLines,
  parsePorcelainZ,
  stage,
  status,
} from '../src/git.js'

const exec = promisify(execFile)

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await exec('git', ['-C', cwd, ...args], { encoding: 'utf8' })
  return stdout
}

async function initRepository(path: string): Promise<void> {
  await mkdir(path, { recursive: true })
  await git(path, 'init', '-q')
  await git(path, 'config', 'user.name', 'Better Git Test')
  await git(path, 'config', 'user.email', 'better-git@example.invalid')
  await writeFile(join(path, 'README.md'), `${path}\n`, 'utf8')
  await git(path, 'add', 'README.md')
  await git(path, 'commit', '-q', '-m', 'initial')
}

test('parses porcelain rename records and log rows', () => {
  assert.deepEqual(parsePorcelainZ('R  new.txt\0old.txt\0?? loose.txt\0'), [
    { path: 'new.txt', xy: 'R ' },
    { path: 'loose.txt', xy: '??' },
  ])
  assert.deepEqual(parseLogLines('abc123\x1fsubject\x1fAlice\x1f2026-01-01 00:00:00 +0000\x1fabcdef\x1fHEAD -> main'), [{
    hash: 'abc123',
    subject: 'subject',
    author: 'Alice',
    date: '2026-01-01 00:00:00 +0000',
    hashFull: 'abcdef',
    refs: 'HEAD -> main',
  }])
})

test('discovers multiple nested repositories below a non-repository workspace', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-better-git-multi-'))
  try {
    const first = join(workspace, 'repo-a')
    const second = join(workspace, 'group', 'repo-b')
    await initRepository(first)
    await initRepository(second)

    const repositories = await discoverRepositories(workspace)
    assert.deepEqual(repositories.map(repository => ({
      relativePath: repository.relativePath,
      kind: repository.kind,
      initialized: repository.initialized,
    })), [
      { relativePath: 'group/repo-b', kind: 'nested', initialized: true },
      { relativePath: 'repo-a', kind: 'nested', initialized: true },
    ])
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('reports status and stages an untracked file in a selected repository', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-better-git-status-'))
  try {
    await initRepository(workspace)
    await writeFile(join(workspace, 'new.txt'), 'new\n', 'utf8')
    assert.deepEqual((await status(workspace)).entries, [{ path: 'new.txt', xy: '??' }])

    await stage(workspace, 'new.txt')
    assert.deepEqual((await status(workspace)).entries, [{ path: 'new.txt', xy: 'A ' }])
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})

test('discovers and initializes an uninitialized local submodule', async () => {
  const workspace = await mkdtemp(join(tmpdir(), 'dsh-better-git-submodule-'))
  try {
    const source = join(workspace, 'source')
    const parent = join(workspace, 'parent')
    await initRepository(source)
    await initRepository(parent)
    await git(parent, 'config', 'protocol.file.allow', 'always')
    await git(parent, '-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', source, 'modules/child')
    await git(parent, 'commit', '-q', '-am', 'add submodule')
    await git(parent, 'submodule', 'deinit', '-f', '--', 'modules/child')

    const target = join(parent, 'modules', 'child')
    const before = await discoverRepositories(parent)
    assert.equal(before.find(repository => repository.path === target)?.state, 'uninitialized')

    await initializeSubmodule(parent, target)
    const after = await discoverRepositories(parent)
    const submodule = after.find(repository => repository.path === target)
    assert.equal(submodule?.initialized, true)
    assert.equal(submodule?.state, 'ready')
  } finally {
    await rm(workspace, { recursive: true, force: true })
  }
})
