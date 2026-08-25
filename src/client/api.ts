/**
 * Typed fetch wrapper over the /better-git JSON API.
 *
 * Unlike better-sidebar's built-in git routes (which pin to the session cwd),
 * every call accepts an explicit `repo` absolute path so the panel can switch
 * between discovered repositories.
 */

export interface GitStatusEntry {
  path: string
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

export interface GitRepositoryInfo {
  path: string
  relativePath: string
  name: string
  kind: 'root' | 'nested' | 'submodule'
  initialized: boolean
  state: 'ready' | 'uninitialized' | 'out-of-sync' | 'conflicted'
}

export interface SessionScope {
  sessionId: string
  cwd?: string
}

async function call<T>(method: string, payload: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  const init: RequestInit = {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }
  if (signal !== undefined) init.signal = signal
  let response: Response
  try {
    response = await fetch(`/better-git/api/${method}`, init)
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : String(error))
  }
  const body = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(body?.error ?? `HTTP ${response.status}`)
  }
  return body as T
}

function scopePayload(scope: SessionScope, extra: Record<string, unknown>): Record<string, unknown> {
  return {
    sessionId: scope.sessionId,
    ...(scope.cwd !== undefined && scope.cwd !== '' ? { cwd: scope.cwd } : {}),
    ...extra,
  }
}

export const api = {
  repositories: (scope: SessionScope, signal?: AbortSignal) =>
    call<GitRepositoryInfo[]>('git.repositories', scopePayload(scope, {}), signal),

  status: (scope: SessionScope, repo: string, signal?: AbortSignal) =>
    call<GitStatusResult>('git.status', scopePayload(scope, { repo }), signal),

  diff: (scope: SessionScope, repo: string, path: string | undefined, staged: boolean, signal?: AbortSignal) =>
    call<{ diff: string }>('git.diff', scopePayload(scope, { repo, ...(path !== undefined ? { path } : {}), staged }), signal),

  stage: (scope: SessionScope, repo: string, path?: string) =>
    call<{ ok: true }>('git.stage', scopePayload(scope, { repo, ...(path !== undefined ? { path } : {}) })),

  unstage: (scope: SessionScope, repo: string, path?: string) =>
    call<{ ok: true }>('git.unstage', scopePayload(scope, { repo, ...(path !== undefined ? { path } : {}) })),

  commit: (scope: SessionScope, repo: string, message: string) =>
    call<{ ok: true }>('git.commit', scopePayload(scope, { repo, message })),

  branch: (scope: SessionScope, repo: string, signal?: AbortSignal) =>
    call<{ current: string; names: string[] }>('git.branch', scopePayload(scope, { repo }), signal),

  checkout: (scope: SessionScope, repo: string, branch: string) =>
    call<{ ok: true }>('git.checkout', scopePayload(scope, { repo, branch })),

  log: (scope: SessionScope, repo: string, count?: number, skip?: number, signal?: AbortSignal) =>
    call<GitLogEntry[]>('git.log', scopePayload(scope, {
      repo,
      ...(count !== undefined ? { count } : {}),
      ...(skip !== undefined ? { skip } : {}),
    }), signal),

  commitDiff: (scope: SessionScope, repo: string, hash: string, signal?: AbortSignal) =>
    call<{ diff: string }>('git.commit-diff', scopePayload(scope, { repo, hash }), signal),

  discard: (scope: SessionScope, repo: string, path: string) =>
    call<{ ok: true }>('git.discard', scopePayload(scope, { repo, path })),

  revert: (scope: SessionScope, repo: string, hash: string) =>
    call<{ ok: true }>('git.revert', scopePayload(scope, { repo, hash })),

  cherryPick: (scope: SessionScope, repo: string, hash: string) =>
    call<{ ok: true }>('git.cherry-pick', scopePayload(scope, { repo, hash })),

  submoduleInit: (scope: SessionScope, target: string) =>
    call<{ ok: true }>('git.submodule-init', scopePayload(scope, { target })),
}
