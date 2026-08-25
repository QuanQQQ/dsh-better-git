/**
 * Git operations for the better-git panel.
 *
 * Reuses the same design as dsh-better-sidebar's git.ts: every command goes
 * through the system `git` binary spawned per request (no library, no state),
 * with porcelain-parseable output formats (`-z` NUL framing, unit separators).
 *
 * On top of the single-repo operations, this module adds multi-repository
 * discovery: when the session cwd is NOT inside a git work tree, we scan the
 * workspace for nested git repositories (bounded depth + directory budget)
 * and also enumerate git submodules of every discovered repository.
 */
import { spawn } from 'node:child_process'
import { lstat, opendir } from 'node:fs/promises'
import { basename, isAbsolute, join, relative, resolve } from 'node:path'

// ── Types ───────────────────────────────────────────────────────────────────

export interface GitStatusEntry {
  path: string
  /** Two-letter index/worktree status (X Y), e.g. 'M ', ' M', 'A ', '??'. */
  xy: string
}

export interface GitStatusResult {
  isRepo: boolean
  branch?: string
  entries: GitStatusEntry[]
}

export interface GitLogEntry {
  hash: string
  hashFull: string
  subject: string
  author: string
  date: string
  refs: string
}

/** One work tree the source-control panel can target. */
export interface GitRepositoryInfo {
  /** Absolute work-tree root on the Host. */
  path: string
  /** Path relative to the discovery workspace (`.` when cwd is in this root). */
  relativePath: string
  /** Compact display label. */
  name: string
  kind: 'root' | 'nested' | 'submodule'
  initialized: boolean
  state: 'ready' | 'uninitialized' | 'out-of-sync' | 'conflicted'
}

export class GitCommandError extends Error {
  constructor(
    message: string,
    readonly code = 'git-error',
    readonly command: string,
  ) {
    super(message)
  }
}

// ── Parsing ─────────────────────────────────────────────────────────────────

export function parsePorcelainZ(output: string): GitStatusEntry[] {
  const tokens = output.split('\0')
  const entries: GitStatusEntry[] = []
  let index = 0
  while (index < tokens.length) {
    const token = tokens[index]!
    index += 1
    if (token === '') continue
    const xy = token.slice(0, 2)
    const rest = token.slice(3)
    entries.push({ path: rest, xy })
    if ((xy[0] === 'R' || xy[0] === 'C') && tokens[index] !== undefined && tokens[index] !== '') {
      index += 1
    }
  }
  return entries
}

export function parseLogLines(output: string): GitLogEntry[] {
  const rows: GitLogEntry[] = []
  for (const line of output.split('\n')) {
    if (line === '') continue
    const [hash, subject, author, date, hashFull, refs] = line.split('\x1f')
    if (hash === undefined || subject === undefined) continue
    rows.push({
      hash,
      subject,
      author: author ?? '',
      date: date ?? '',
      hashFull: hashFull ?? hash,
      refs: refs ?? '',
    })
  }
  return rows
}

// ── Runner ──────────────────────────────────────────────────────────────────

function runGit(cwd: string, args: string[], timeoutMs = 30_000): Promise<string> {
  const full = ['-C', cwd, '--no-pager', '-c', 'color.ui=false', ...args]
  return new Promise<string>((resolvePromise, reject) => {
    const child = spawn('git', full, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' },
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      reject(new GitCommandError(`git ${args[0] ?? ''} timed out after ${timeoutMs}ms`, 'git-error', args.join(' ')))
    }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(new GitCommandError(`cannot run git: ${error.message}`, 'git-error', args.join(' ')))
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      if (code === 0) {
        resolvePromise(stdout)
      } else {
        reject(new GitCommandError(stderr.trim() || `git exited with ${String(code)}`, 'git-error', args.join(' ')))
      }
    })
  })
}

// ── Single-repo operations ──────────────────────────────────────────────────

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    const out = await runGit(cwd, ['rev-parse', '--is-inside-work-tree'])
    return out.trim() === 'true'
  } catch {
    return false
  }
}

export async function repoRoot(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['rev-parse', '--show-toplevel'])
  return out.trim()
}

export async function currentBranch(cwd: string): Promise<string> {
  const out = await runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  return out.trim()
}

export async function status(cwd: string): Promise<GitStatusResult> {
  const repo = await isGitRepo(cwd)
  if (!repo) return { isRepo: false, entries: [] }
  const [branch, raw] = await Promise.all([
    currentBranch(cwd).catch(() => 'HEAD'),
    runGit(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=normal']),
  ])
  return { isRepo: true, branch, entries: parsePorcelainZ(raw) }
}

export async function diff(cwd: string, path: string | undefined, staged: boolean): Promise<string> {
  const args = ['diff', '--no-ext-diff', '--no-color', '-U3']
  if (staged) args.push('--cached')
  if (path !== undefined) args.push('--', path)
  return runGit(cwd, args)
}

export async function stage(cwd: string, path: string | undefined): Promise<void> {
  await runGit(cwd, ['add', '-A', ...(path !== undefined ? ['--', path] : [])])
}

export async function unstage(cwd: string, path: string | undefined): Promise<void> {
  await runGit(cwd, ['reset', '-q', ...(path !== undefined ? ['--', path] : [])])
}

export async function commit(cwd: string, message: string): Promise<void> {
  await runGit(cwd, ['commit', '-m', message])
}

export async function branches(cwd: string): Promise<{ current: string; names: string[] }> {
  const [current, raw] = await Promise.all([
    currentBranch(cwd).catch(() => 'HEAD'),
    runGit(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads']),
  ])
  const names = raw.split('\n').filter(line => line !== '')
  return { current, names: names.includes(current) ? names : [current, ...names] }
}

export async function checkout(cwd: string, branch: string): Promise<void> {
  await runGit(cwd, ['checkout', branch])
}

export async function log(cwd: string, count = 30, skip = 0): Promise<GitLogEntry[]> {
  const raw = await runGit(cwd, [
    'log', '-n', String(count), '--skip', String(skip), '--decorate=short',
    '--pretty=format:%h%x1f%s%x1f%an%x1f%ai%x1f%H%x1f%D',
  ])
  return parseLogLines(raw)
}

export async function show(cwd: string, rev: string, path: string): Promise<string | null> {
  try {
    return await runGit(cwd, ['show', `${rev}:${path}`])
  } catch {
    return null
  }
}

export async function commitDiff(cwd: string, hash: string): Promise<string> {
  return runGit(cwd, ['show', '--no-ext-diff', '--no-color', '--format=', '-m', '--first-parent', hash])
}

export async function discard(cwd: string, path: string): Promise<void> {
  await runGit(cwd, ['checkout', '--', path])
}

export async function revert(cwd: string, hash: string): Promise<void> {
  await runGit(cwd, ['revert', '--no-edit', hash])
}

export async function cherryPick(cwd: string, hash: string): Promise<void> {
  await runGit(cwd, ['cherry-pick', hash])
}

// ── Multi-repo discovery ────────────────────────────────────────────────────

const NESTED_SCAN_MAX_DEPTH = 4
const NESTED_SCAN_MAX_DIRECTORIES = 2_000
const NESTED_SCAN_IGNORED = new Set(['.git', '.dsh', '.cache', '.next', '.pnpm', 'node_modules', 'dist', 'build', 'coverage'])

function isWithinDirectory(base: string, target: string): boolean {
  const value = relative(base, target)
  return value === '' || (!isAbsolute(value) && !/^\.\.(?:[\\/]|$)/.test(value))
}

function displayRelative(base: string, target: string): string {
  const value = relative(base, target)
  if (value === '') return '.'
  return process.platform === 'win32' ? value.replace(/\\/g, '/') : value
}

async function hasGitMarker(directory: string): Promise<boolean> {
  try {
    const marker = await lstat(join(directory, '.git'))
    return marker.isFile() || marker.isDirectory()
  } catch {
    return false
  }
}

/**
 * Find repository roots below a non-repository workspace with a strict depth
 * and directory budget. Once a repository is found, its interior is handled
 * by `git submodule status` instead of an unbounded filesystem crawl.
 */
async function findNestedRepositoryRoots(workspace: string): Promise<string[]> {
  const queue: Array<{ path: string; depth: number }> = [{ path: workspace, depth: 0 }]
  const roots = new Set<string>()
  let cursor = 0
  let scanned = 0
  while (cursor < queue.length && scanned < NESTED_SCAN_MAX_DIRECTORIES) {
    const current = queue[cursor++]!
    scanned += 1
    if (current.depth > 0 && await hasGitMarker(current.path) && await isGitRepo(current.path)) {
      const root = await repoRoot(current.path)
      if (isWithinDirectory(workspace, root)) roots.add(root)
      continue
    }
    if (current.depth >= NESTED_SCAN_MAX_DEPTH) continue
    try {
      const directory = await opendir(current.path)
      for await (const entry of directory) {
        if (!entry.isDirectory() || NESTED_SCAN_IGNORED.has(entry.name)) continue
        queue.push({ path: join(current.path, entry.name), depth: current.depth + 1 })
      }
    } catch {
      // One unreadable directory must not hide accessible sibling repositories.
    }
  }
  return [...roots].sort((left, right) => displayRelative(workspace, left).localeCompare(displayRelative(workspace, right)))
}

/** Describe one root repository and every submodule Git reports recursively. */
async function repositoryTree(
  root: string,
  displayBase: string,
  rootKind: 'root' | 'nested',
): Promise<GitRepositoryInfo[]> {
  const repositories: GitRepositoryInfo[] = [{
    path: root,
    relativePath: displayRelative(displayBase, root),
    name: basename(root),
    kind: rootKind,
    initialized: true,
    state: 'ready',
  }]
  const raw = await runGit(root, ['submodule', 'status', '--recursive'])
  for (const line of raw.split('\n')) {
    if (line === '') continue
    const match = /^([ +\-U])([0-9a-f]+) (.+?)(?: \([^)]*\))?$/.exec(line)
    if (match === null) continue
    const marker = match[1]!
    const path = resolve(root, match[3]!)
    repositories.push({
      path,
      relativePath: displayRelative(displayBase, path),
      name: basename(path),
      kind: 'submodule',
      initialized: marker !== '-',
      state: marker === '-' ? 'uninitialized' : marker === '+' ? 'out-of-sync' : marker === 'U' ? 'conflicted' : 'ready',
    })
  }
  return repositories
}

/**
 * Discover the containing repository, or repositories nested below a
 * non-repository workspace, plus every submodule Git can describe.
 */
export async function discoverRepositories(cwd: string): Promise<GitRepositoryInfo[]> {
  if (await isGitRepo(cwd)) {
    const root = await repoRoot(cwd)
    return repositoryTree(root, root, 'root')
  }
  const workspace = resolve(cwd)
  const repositories: GitRepositoryInfo[] = []
  for (const root of await findNestedRepositoryRoots(workspace)) {
    repositories.push(...await repositoryTree(root, workspace, 'nested'))
  }
  return repositories
}

/** Initialize one declared submodule (and its nested submodules) explicitly. */
export async function initializeSubmodule(cwd: string, target: string): Promise<void> {
  const absolute = resolve(target)
  const repositories = await discoverRepositories(cwd)
  const repository = repositories.find(item => item.kind === 'submodule' && item.path === absolute)
  if (repository === undefined) {
    throw new GitCommandError(`"${target}" is not a declared submodule`, 'git-error', 'submodule update')
  }
  const parent = repositories
    .filter(item => item.initialized && item.path !== absolute && isWithinDirectory(item.path, absolute))
    .sort((left, right) => right.path.length - left.path.length)[0]
  if (parent === undefined) {
    throw new GitCommandError(`cannot find an initialized parent for "${target}"`, 'git-error', 'submodule update')
  }
  const relativePath = relative(parent.path, absolute)
  const pathFromParent = process.platform === 'win32' ? relativePath.replace(/\\/g, '/') : relativePath
  await runGit(parent.path, ['submodule', 'update', '--init', '--recursive', '--', pathFromParent], 120_000)
}
