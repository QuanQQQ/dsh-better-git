/**
 * Host half of dsh-better-git: registers the `/better-git/api` JSON route
 * that exposes multi-repository-aware git operations. Unlike better-sidebar's
 * built-in git routes (which are pinned to the session cwd), every call here
 * accepts an explicit `repo` path so the client can switch between discovered
 * repositories.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { resolve } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { SessionId } from '@deepseek-ai/dsh-session'
import type { WebRuntimeValues } from '@deepseek-ai/dsh-web-app'
import * as git from './git.js'
import { isTrustedBetterGitRequest } from './trust-fence.js'

export const name = 'dsh-better-git'
export const inject = ['webServer', 'sessions', 'webRuntime']

type HostContext = Context & {
  webRuntime: WebRuntimeValues
}

function requireString(payload: unknown, key: string): string {
  const record = payload as Record<string, unknown> | null
  const value = record?.[key]
  if (typeof value !== 'string' || value === '') {
    throw new Error(`missing required string field "${key}"`)
  }
  return value
}

function requireAbsolute(path: string): string {
  if (!/^([A-Za-z]:[\\/]|\/)/.test(path)) {
    throw new Error(`path must be absolute: "${path}"`)
  }
  return path
}

function sessionCwd(ctx: HostContext, sessionId: string, clientCwd?: string): string {
  const session = ctx.sessions.get(sessionId as SessionId)
  const headerCwd = session?.header?.cwd
  if (headerCwd !== undefined && headerCwd !== '') return headerCwd
  if (clientCwd !== undefined && clientCwd !== '') return requireAbsolute(clientCwd)
  return process.cwd()
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const MAX_JSON_BODY_BYTES = 64 * 1024

async function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolvePromise, reject) => {
    let data = ''
    let bytes = 0
    let settled = false
    req.on('data', (chunk: Buffer) => {
      if (settled) return
      bytes += chunk.length
      if (bytes > MAX_JSON_BODY_BYTES) {
        settled = true
        reject(new Error(`request body exceeds ${MAX_JSON_BODY_BYTES} bytes`))
        return
      }
      data += chunk.toString('utf8')
    })
    req.on('end', () => {
      if (settled) return
      settled = true
      if (data === '') { resolvePromise({}); return }
      try { resolvePromise(JSON.parse(data)) } catch (error) { reject(error) }
    })
    req.on('error', (error) => {
      if (settled) return
      settled = true
      reject(error)
    })
  })
}

export function apply(ctx: HostContext): void {
  const trustedHosts = [...ctx.webRuntime.trustedHosts]

  const workspaceOf = (payload: unknown): string => {
    const record = payload as { sessionId?: unknown; cwd?: unknown } | null
    const sessionId = requireString(payload, 'sessionId')
    const clientCwd = typeof record?.cwd === 'string' ? record.cwd : undefined
    return sessionCwd(ctx, sessionId, clientCwd)
  }

  /** Resolve only work trees discovered from this session's workspace. */
  const resolveRepo = async (payload: unknown): Promise<string> => {
    const workspace = workspaceOf(payload)
    const repositories = await git.discoverRepositories(workspace)
    const record = payload as { repo?: unknown } | null
    if (typeof record?.repo !== 'string' || record.repo === '') {
      const ready = repositories.filter(repository => repository.initialized)
      if (ready.length === 1) return ready[0]!.path
      throw new Error('an explicit discovered repository is required')
    }
    const requested = resolve(requireAbsolute(record.repo))
    const repository = repositories.find(item => item.initialized && resolve(item.path) === requested)
    if (repository === undefined) {
      throw new Error(`repository is outside the session workspace or unavailable: "${record.repo}"`)
    }
    return repository.path
  }

  const methods: Record<string, (payload: unknown) => unknown | Promise<unknown>> = {
    'git.repositories': async (payload) => {
      return git.discoverRepositories(workspaceOf(payload))
    },
    'git.status': async (payload) => {
      const repo = await resolveRepo(payload)
      return git.status(repo)
    },
    'git.diff': async (payload) => {
      const repo = await resolveRepo(payload)
      const record = payload as { path?: unknown; staged?: unknown } | null
      const path = record?.path === undefined ? undefined : requireString(payload, 'path')
      return { diff: await git.diff(repo, path, record?.staged === true) }
    },
    'git.stage': async (payload) => {
      const repo = await resolveRepo(payload)
      const record = payload as { path?: unknown } | null
      const path = record?.path === undefined ? undefined : requireString(payload, 'path')
      await git.stage(repo, path)
      return { ok: true }
    },
    'git.unstage': async (payload) => {
      const repo = await resolveRepo(payload)
      const record = payload as { path?: unknown } | null
      const path = record?.path === undefined ? undefined : requireString(payload, 'path')
      await git.unstage(repo, path)
      return { ok: true }
    },
    'git.commit': async (payload) => {
      const repo = await resolveRepo(payload)
      const message = requireString(payload, 'message')
      await git.commit(repo, message)
      return { ok: true }
    },
    'git.branch': async (payload) => {
      const repo = await resolveRepo(payload)
      return git.branches(repo)
    },
    'git.checkout': async (payload) => {
      const repo = await resolveRepo(payload)
      await git.checkout(repo, requireString(payload, 'branch'))
      return { ok: true }
    },
    'git.log': async (payload) => {
      const repo = await resolveRepo(payload)
      const record = payload as { count?: unknown; skip?: unknown } | null
      const count = typeof record?.count === 'number' && Number.isInteger(record.count) && record.count > 0
        ? record.count
        : undefined
      const skip = typeof record?.skip === 'number' && Number.isInteger(record.skip) && record.skip >= 0
        ? record.skip
        : undefined
      return git.log(repo, count, skip)
    },
    'git.commit-diff': async (payload) => {
      const repo = await resolveRepo(payload)
      return { diff: await git.commitDiff(repo, requireString(payload, 'hash')) }
    },
    'git.discard': async (payload) => {
      const repo = await resolveRepo(payload)
      await git.discard(repo, requireString(payload, 'path'))
      return { ok: true }
    },
    'git.revert': async (payload) => {
      const repo = await resolveRepo(payload)
      await git.revert(repo, requireString(payload, 'hash'))
      return { ok: true }
    },
    'git.cherry-pick': async (payload) => {
      const repo = await resolveRepo(payload)
      await git.cherryPick(repo, requireString(payload, 'hash'))
      return { ok: true }
    },
    'git.submodule-init': async (payload) => {
      const workspace = workspaceOf(payload)
      const target = requireAbsolute(requireString(payload, 'target'))
      await git.initializeSubmodule(workspace, target)
      return { ok: true }
    },
  }

  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/better-git/api',
    handler: async (req, res) => {
      if (!isTrustedBetterGitRequest(req, trustedHosts)) {
        sendJson(res, 403, { error: 'request authority is not trusted' })
        return
      }
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'method not allowed' })
        return
      }
      const url = new URL(req.url ?? '/', 'http://dsh.internal')
      const method = url.pathname.slice('/better-git/api/'.length)
      const handler = methods[method]
      if (handler === undefined) {
        sendJson(res, 404, { error: `unknown method "${method}"` })
        return
      }
      try {
        const payload = req.method === 'POST' ? await readJson(req) : {}
        const result = await handler(payload)
        sendJson(res, 200, result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendJson(res, 400, { error: message })
      }
    },
  }), 'dsh-better-git: /better-git/api routes')
}
